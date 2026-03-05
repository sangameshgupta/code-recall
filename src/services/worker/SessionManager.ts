import { runSDKAgent, getAgentPoolStatus, type SDKAgentResult } from './SDKAgent.js';
import { SessionQueueProcessor } from '../queue/SessionQueueProcessor.js';
import type { CodeRecallDatabase } from '../sqlite/Database.js';
import type { SessionsStore } from '../sqlite/Sessions.js';
import type { ObservationsStore } from '../sqlite/Observations.js';
import type { SummariesStore } from '../sqlite/Summaries.js';
import type { PendingMessageStore } from '../sqlite/PendingMessageStore.js';
import { storeObservationsAndMarkComplete, storeSummaryAndMarkComplete } from '../sqlite/transactions.js';
import type { SSEBroadcaster } from './SSEBroadcaster.js';
import type { SdkSession } from '../../types/database.js';
import type { ParsedObservation } from '../../sdk/parser.js';

interface SessionState {
  queueProcessor: SessionQueueProcessor;
  abortController: AbortController;
  agentPromise: Promise<SDKAgentResult> | null;
  eventCount: number;
}

/**
 * Manages active sessions and their SDK agent lifecycles.
 * One SessionManager per worker — coordinates agent pool, queue processing, and storage.
 */
export class SessionManager {
  private activeSessions = new Map<string, SessionState>();

  constructor(
    private db: CodeRecallDatabase,
    private sessions: SessionsStore,
    private observations: ObservationsStore,
    private summaries: SummariesStore,
    private pendingMessages: PendingMessageStore,
    private sseBroadcaster: SSEBroadcaster,
    private settings: {
      maxConcurrentAgents: number;
      model: string;
      idleTimeoutMs: number;
    },
  ) {}

  /**
   * Ensure a session has an active agent processing its queue.
   * Called when new messages are enqueued for a session.
   */
  async ensureAgentRunning(contentSessionId: string): Promise<void> {
    // Already has an active agent
    if (this.activeSessions.has(contentSessionId)) {
      // Wake the queue processor in case it's waiting
      this.activeSessions.get(contentSessionId)!.queueProcessor.wake();
      return;
    }

    // Look up the session
    const session = this.sessions.getByContentSessionId(contentSessionId);
    if (!session || session.status !== 'active') return;

    // Start a new agent
    await this.startAgent(session);
  }

  private async startAgent(session: SdkSession): Promise<void> {
    const contentSessionId = session.content_session_id;

    const abortController = new AbortController();
    const queueProcessor = new SessionQueueProcessor({
      contentSessionId,
      claimFn: (id) => this.pendingMessages.claimNext(id),
      idleTimeoutMs: this.settings.idleTimeoutMs,
      abortController,
    });

    const state: SessionState = {
      queueProcessor,
      abortController,
      agentPromise: null,
      eventCount: 0,
    };

    this.activeSessions.set(contentSessionId, state);

    // Run agent in background (non-blocking)
    state.agentPromise = runSDKAgent({
      session,
      project: session.project,
      queueProcessor,
      maxConcurrent: this.settings.maxConcurrentAgents,
      model: this.settings.model,

      // Called when queue processor confirms a message
      confirmMessageFn: (messageId) => {
        this.pendingMessages.confirm(messageId);
      },

      // Called when observations are parsed from agent response
      onObservations: (obs, messageId) => {
        this.storeObservations(contentSessionId, session.project, obs);
        state.eventCount += obs.length;
      },

      // Called when a summary is parsed
      onSummary: (summary) => {
        const memSessionId = session.memory_session_id ?? contentSessionId;
        this.summaries.insert({
          memorySessionId: memSessionId,
          project: session.project,
          request: summary.request ?? undefined,
          investigated: summary.investigated ?? undefined,
          learned: summary.learned ?? undefined,
          completed: summary.completed ?? undefined,
          nextSteps: summary.next_steps ?? undefined,
          filesRead: summary.files_read ?? undefined,
          filesEdited: summary.files_edited ?? undefined,
          notes: summary.notes ?? undefined,
        });
        this.sseBroadcaster.broadcast('summary_created', {
          memorySessionId: memSessionId,
          project: session.project,
        });
      },

      // Called when SDK agent returns its session ID
      onMemorySessionId: (memorySessionId) => {
        // CRITICAL: Capture memorySessionId for future resume
        this.sessions.setMemorySessionId(contentSessionId, memorySessionId);
      },
    });

    // Clean up when agent finishes
    state.agentPromise
      .then((result) => {
        console.error(
          `[code-recall] Agent finished for ${contentSessionId}: ` +
          `${result.observations.length} observations, ` +
          `${result.summary ? 'with' : 'no'} summary`
        );
      })
      .catch((err) => {
        console.error(`[code-recall] Agent error for ${contentSessionId}:`, (err as Error).message);
      })
      .finally(() => {
        this.activeSessions.delete(contentSessionId);
      });
  }

  /**
   * Store parsed observations atomically.
   */
  private storeObservations(contentSessionId: string, project: string, parsed: ParsedObservation[]): void {
    const session = this.sessions.getByContentSessionId(contentSessionId);
    // Use memory_session_id for storage association if available, else content_session_id
    const memSessionId = session?.memory_session_id ?? contentSessionId;

    for (const obs of parsed) {
      const id = this.observations.insert({
        memorySessionId: memSessionId,
        project,
        text: obs.narrative ?? obs.title ?? '',
        type: obs.type,
        title: obs.title ?? undefined,
        subtitle: obs.subtitle ?? undefined,
        narrative: obs.narrative ?? undefined,
        facts: obs.facts.length > 0 ? obs.facts : undefined,
        concepts: obs.concepts.length > 0 ? obs.concepts : undefined,
        filesRead: obs.files_read.length > 0 ? obs.files_read : undefined,
        filesModified: obs.files_modified.length > 0 ? obs.files_modified : undefined,
      });

      if (id !== null) {
        this.sseBroadcaster.broadcast('observation_created', {
          id,
          type: obs.type,
          title: obs.title,
          project,
        });
      }
    }
  }

  /**
   * Notify a session's queue processor that new messages are available.
   */
  wakeSession(contentSessionId: string): void {
    const state = this.activeSessions.get(contentSessionId);
    if (state) {
      state.queueProcessor.wake();
    }
  }

  /**
   * Signal a session to produce its summary and finish.
   */
  requestSummary(contentSessionId: string): void {
    const state = this.activeSessions.get(contentSessionId);
    if (state) {
      state.queueProcessor.finish();
    }
  }

  /**
   * Abort a session's agent
   */
  abortSession(contentSessionId: string): void {
    const state = this.activeSessions.get(contentSessionId);
    if (state) {
      state.abortController.abort();
      this.activeSessions.delete(contentSessionId);
    }
  }

  /**
   * Get status of all active sessions
   */
  getStatus(): {
    activeSessions: number;
    agentPool: { active: number; waiting: number };
    sessions: Array<{ contentSessionId: string; eventCount: number }>;
  } {
    return {
      activeSessions: this.activeSessions.size,
      agentPool: getAgentPoolStatus(),
      sessions: Array.from(this.activeSessions.entries()).map(([id, state]) => ({
        contentSessionId: id,
        eventCount: state.eventCount,
      })),
    };
  }
}
