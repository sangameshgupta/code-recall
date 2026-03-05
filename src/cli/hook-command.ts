import { readStdin } from './stdin-reader.js';
import { adaptClaudeCodeEvent } from './adapters/claude-code.js';
import { handleContext } from './handlers/context.js';
import { handleSessionInit } from './handlers/session-init.js';
import { handleObservation } from './handlers/observation.js';
import { handleSummarize } from './handlers/summarize.js';
import { handleSessionComplete } from './handlers/session-complete.js';
import { STANDARD_HOOK_RESPONSE } from '../shared/hook-constants.js';
import type { HookAction, HookResponse, AdapterType } from './types.js';

const HANDLERS: Record<HookAction, (event: any) => Promise<HookResponse>> = {
  'context': handleContext,
  'session-init': handleSessionInit,
  'observation': handleObservation,
  'summarize': handleSummarize,
  'session-complete': handleSessionComplete,
};

/**
 * Main hook command router.
 * Called as: worker-service.cjs hook <adapter> <action>
 */
export async function runHookCommand(adapter: AdapterType, action: HookAction): Promise<void> {
  try {
    const handler = HANDLERS[action];
    if (!handler) {
      console.error(`[code-recall] Unknown hook action: ${action}`);
      console.log(STANDARD_HOOK_RESPONSE);
      process.exit(0);
      return;
    }

    // Read event data from stdin
    const rawInput = await readStdin();

    // Adapt based on CLI environment
    let event;
    switch (adapter) {
      case 'claude-code':
        event = adaptClaudeCodeEvent(rawInput) ?? {};
        break;
      case 'cursor':
        // Future: Cursor-specific adaptation
        event = adaptClaudeCodeEvent(rawInput) ?? {};
        break;
      default:
        event = rawInput ?? {};
    }

    // Execute handler
    const response = await handler(event);

    // Output response to stdout (this is what Claude Code reads)
    console.log(JSON.stringify(response));
  } catch (err) {
    // CRITICAL: Always exit 0 and output valid response
    // Errors should never block Claude Code operation
    console.error(`[code-recall] Hook error (${action}):`, (err as Error).message);
    console.log(STANDARD_HOOK_RESPONSE);
  }

  process.exit(0);
}
