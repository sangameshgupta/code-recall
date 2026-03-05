import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import { buildInitPrompt, buildObservationPrompt, buildSummaryPrompt, buildContinuationPrompt } from '../../sdk/prompts.js';
import { parseObservations, parseSummary } from '../../sdk/parser.js';
import { SessionQueueProcessor } from '../queue/SessionQueueProcessor.js';
import { EnvManager } from '../../shared/EnvManager.js';
import { PATHS } from '../../shared/paths.js';
import { existsSync, mkdirSync } from 'fs';
import type { PendingMessage, SdkSession } from '../../types/database.js';
import type { ParsedObservation, ParsedSummary } from '../../sdk/parser.js';

/** Max concurrent SDK agents to prevent resource exhaustion */
const DEFAULT_MAX_CONCURRENT = 2;

/** Max tool events before forcing session split (context window protection) */
const MAX_EVENTS_PER_SESSION = 100;

// Agent pool tracking
let activeAgents = 0;
const waitQueue: Array<() => void> = [];

/**
 * Wait for an available agent slot.
 */
async function waitForSlot(maxConcurrent: number): Promise<void> {
  if (activeAgents < maxConcurrent) {
    activeAgents++;
    return;
  }

  return new Promise<void>((resolve) => {
    waitQueue.push(() => {
      activeAgents++;
      resolve();
    });
  });
}

function releaseSlot(): void {
  activeAgents--;
  const next = waitQueue.shift();
  if (next) next();
}

export interface SDKAgentResult {
  observations: ParsedObservation[];
  summary: ParsedSummary | null;
  memorySessionId: string | null;
  eventCount: number;
}

export interface SDKAgentOptions {
  session: SdkSession;
  project: string;
  queueProcessor: SessionQueueProcessor;
  maxConcurrent?: number;
  model?: string;
  confirmMessageFn: (messageId: number) => void;
  onObservations?: (obs: ParsedObservation[], messageId: number) => void;
  onSummary?: (summary: ParsedSummary) => void;
  onMemorySessionId?: (memorySessionId: string) => void;
}

/**
 * Run the SDK observer agent for a session.
 * Spawns a secondary Claude agent that watches tool usage and generates observations.
 */
export async function runSDKAgent(opts: SDKAgentOptions): Promise<SDKAgentResult> {
  const {
    session,
    project,
    queueProcessor,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    model = 'claude-sonnet-4-5',
    confirmMessageFn,
    onObservations,
    onSummary,
    onMemorySessionId,
  } = opts;

  // Ensure observer sessions directory exists
  if (!existsSync(PATHS.observerSessionsDir)) {
    mkdirSync(PATHS.observerSessionsDir, { recursive: true });
  }

  const envManager = new EnvManager();
  const isolatedEnv = envManager.getIsolatedEnv();

  // Determine if we should resume
  const hasRealMemorySessionId = !!session.memory_session_id;
  const shouldResume = hasRealMemorySessionId && !!(session as any).lastPromptNumber && (session as any).lastPromptNumber > 1;

  const allObservations: ParsedObservation[] = [];
  let capturedSummary: ParsedSummary | null = null;
  let capturedMemorySessionId: string | null = session.memory_session_id;
  let eventCount = 0;

  await waitForSlot(maxConcurrent);

  try {
    // Build the async message generator
    const messages = createMessageGenerator(
      session,
      project,
      queueProcessor,
      shouldResume,
      confirmMessageFn,
      (obs, msgId) => {
        allObservations.push(...obs);
        if (onObservations) onObservations(obs, msgId);
      },
      (summary) => {
        capturedSummary = summary;
        if (onSummary) onSummary(summary);
      },
      () => eventCount++,
    );

    // Spawn the SDK agent
    const agentStream = query({
      prompt: messages,
      options: {
        model,
        cwd: PATHS.observerSessionsDir,
        ...(shouldResume && session.memory_session_id
          ? { resume: session.memory_session_id }
          : {}),
        disallowedTools: [
          'Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob',
          'WebFetch', 'WebSearch', 'Task', 'NotebookEdit',
          'AskUserQuestion', 'TodoWrite',
        ],
        abortController: new AbortController(),
        env: isolatedEnv,
      },
    });

    // Process agent responses
    for await (const message of agentStream) {
      // Capture memorySessionId from first response
      if (!capturedMemorySessionId && (message as any).sessionId) {
        capturedMemorySessionId = (message as any).sessionId;
        if (onMemorySessionId) onMemorySessionId(capturedMemorySessionId!);
      }

      // Extract observations from assistant text
      if ((message as any).type === 'assistant' || (message as any).content) {
        const text = typeof (message as any).content === 'string'
          ? (message as any).content
          : JSON.stringify((message as any).content);

        // Try parsing observations
        const obs = parseObservations(text);
        if (obs.length > 0) {
          allObservations.push(...obs);
        }

        // Try parsing summary
        const summary = parseSummary(text);
        if (summary) {
          capturedSummary = summary;
          if (onSummary) onSummary(summary);
        }
      }

      // Check for final result with session ID
      if ((message as any).type === 'result' && (message as any).sessionId) {
        if (!capturedMemorySessionId) {
          capturedMemorySessionId = (message as any).sessionId;
          if (onMemorySessionId) onMemorySessionId(capturedMemorySessionId!);
        }
      }
    }
  } catch (err) {
    console.error(`[code-recall] SDK agent error:`, (err as Error).message);
  } finally {
    releaseSlot();
  }

  return {
    observations: allObservations,
    summary: capturedSummary,
    memorySessionId: capturedMemorySessionId,
    eventCount,
  };
}

/**
 * Helper to construct an SDKUserMessage from a text prompt.
 * Uses isSynthetic: true since these are system-generated, not user-typed.
 */
function makeUserMessage(content: string, contentSessionId: string): SDKUserMessage {
  return {
    type: 'user',
    message: { role: 'user', content },
    session_id: contentSessionId,
    parent_tool_use_id: null,
    isSynthetic: true,
  };
}

/**
 * Create the async message generator that feeds the SDK agent.
 * Yields: init prompt → observation prompts (from queue) → summary prompt
 */
async function* createMessageGenerator(
  session: SdkSession,
  project: string,
  queueProcessor: SessionQueueProcessor,
  shouldResume: boolean,
  confirmMessageFn: (messageId: number) => void,
  onObservations: (obs: ParsedObservation[], messageId: number) => void,
  onSummary: (summary: ParsedSummary) => void,
  onEvent: () => void,
): AsyncGenerator<SDKUserMessage> {
  const contentSessionId = session.content_session_id;

  // First message: init prompt or continuation prompt
  if (shouldResume) {
    yield makeUserMessage(buildContinuationPrompt(project), contentSessionId);
  } else {
    yield makeUserMessage(buildInitPrompt(project), contentSessionId);
  }

  let eventCount = 0;

  // Yield observation prompts from the queue
  for await (const message of queueProcessor) {
    if (message.message_type === 'summarize') {
      // Summary request — yield summary prompt and finish
      confirmMessageFn(message.id);
      yield makeUserMessage(buildSummaryPrompt(), contentSessionId);
      break;
    }

    if (message.message_type === 'observation') {
      try {
        const payload = JSON.parse(message.payload);
        yield makeUserMessage(buildObservationPrompt(payload), contentSessionId);
        confirmMessageFn(message.id);
        onEvent();
        eventCount++;

        // Session splitting: force summary after MAX_EVENTS_PER_SESSION
        if (eventCount >= MAX_EVENTS_PER_SESSION) {
          yield makeUserMessage(buildSummaryPrompt(), contentSessionId);
          break;
        }
      } catch (err) {
        console.error(`[code-recall] Failed to parse message payload:`, (err as Error).message);
        confirmMessageFn(message.id); // Don't retry malformed messages
      }
    }
  }
}

/**
 * Get current agent pool status
 */
export function getAgentPoolStatus(): { active: number; waiting: number } {
  return { active: activeAgents, waiting: waitQueue.length };
}
