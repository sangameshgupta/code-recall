import type { HookEventData, HookResponse } from '../types.js';
import { DEFAULT_WORKER_PORT, WORKER_HOST } from '../../shared/paths.js';
import { SettingsDefaultsManager } from '../../shared/SettingsDefaultsManager.js';
import { extractContentSessionId } from '../adapters/claude-code.js';

/**
 * Session complete handler — called on Stop (after summarize).
 * Finalizes session status in the worker.
 */
export async function handleSessionComplete(event: HookEventData): Promise<HookResponse> {
  const contentSessionId = extractContentSessionId(event);
  if (!contentSessionId) {
    return { continue: true, suppressOutput: true };
  }

  const settings = SettingsDefaultsManager.loadFromFile();
  const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;

  try {
    const res = await fetch(`http://${WORKER_HOST}:${port}/api/sessions/${contentSessionId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!res.ok) {
      console.error(`[code-recall] session-complete failed: ${res.status}`);
    }
  } catch {
    // Worker not running — fail silently
  }

  return { continue: true, suppressOutput: true };
}
