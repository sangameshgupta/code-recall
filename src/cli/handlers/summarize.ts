import type { HookEventData, HookResponse } from '../types.js';
import { DEFAULT_WORKER_PORT, WORKER_HOST } from '../../shared/paths.js';
import { SettingsDefaultsManager } from '../../shared/SettingsDefaultsManager.js';
import { extractContentSessionId } from '../adapters/claude-code.js';

const DRAIN_TIMEOUT_MS = 30_000; // 30 seconds to drain the queue
const DRAIN_POLL_INTERVAL_MS = 500;

/**
 * Summarize handler — called on Stop.
 * Waits for pending observations to drain, then enqueues a summary request.
 */
export async function handleSummarize(event: HookEventData): Promise<HookResponse> {
  const contentSessionId = extractContentSessionId(event);
  if (!contentSessionId) {
    return { continue: true, suppressOutput: true };
  }

  const settings = SettingsDefaultsManager.loadFromFile();
  const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;

  try {
    // Wait for pending observations to drain before requesting summary
    const drainStart = Date.now();
    while (Date.now() - drainStart < DRAIN_TIMEOUT_MS) {
      const res = await fetch(`http://${WORKER_HOST}:${port}/api/messages/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentSessionId }),
      });

      if (res.ok) {
        const { message } = await res.json() as { message: unknown };
        if (!message) break; // Queue drained
      } else {
        break;
      }

      await new Promise(r => setTimeout(r, DRAIN_POLL_INTERVAL_MS));
    }

    // Enqueue summary request
    await fetch(`http://${WORKER_HOST}:${port}/api/messages/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentSessionId,
        messageType: 'summarize',
        payload: {
          stop_reason: event.stop_reason,
          project_dir: event.project_dir,
        },
      }),
    });
  } catch {
    // Worker not running — fail silently
  }

  return { continue: true, suppressOutput: true };
}
