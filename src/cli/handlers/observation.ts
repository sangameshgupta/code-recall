import type { HookEventData, HookResponse } from '../types.js';
import { DEFAULT_WORKER_PORT, WORKER_HOST } from '../../shared/paths.js';
import { SettingsDefaultsManager } from '../../shared/SettingsDefaultsManager.js';
import { extractContentSessionId } from '../adapters/claude-code.js';
import { stripPrivateTags } from '../../utils/tag-stripping.js';

const MAX_TOOL_OUTPUT_CHARS = 4000;

/**
 * Observation handler — called on PostToolUse.
 * Forwards tool event to worker as a pending message for the observer agent.
 */
export async function handleObservation(event: HookEventData): Promise<HookResponse> {
  const contentSessionId = extractContentSessionId(event);
  if (!contentSessionId) {
    return { continue: true, suppressOutput: true };
  }

  const settings = SettingsDefaultsManager.loadFromFile();
  const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;

  // Strip private tags from tool output before sending to observer
  let toolOutput = event.tool_output ?? '';
  if (settings.CODE_RECALL_PRIVACY_STRIP_TAGS === 'true') {
    toolOutput = stripPrivateTags(toolOutput);
  }

  // Truncate large tool outputs
  if (toolOutput.length > MAX_TOOL_OUTPUT_CHARS) {
    toolOutput = toolOutput.slice(0, MAX_TOOL_OUTPUT_CHARS) + '\n[...truncated]';
  }

  const payload = {
    tool_name: event.tool_name,
    tool_input: event.tool_input,
    tool_output: toolOutput,
    project_dir: event.project_dir,
  };

  try {
    const res = await fetch(`http://${WORKER_HOST}:${port}/api/messages/enqueue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentSessionId,
        messageType: 'observation',
        payload,
      }),
    });

    if (!res.ok) {
      console.error(`[code-recall] observation enqueue failed: ${res.status}`);
    }
  } catch {
    // Worker not running — fail silently
  }

  return { continue: true, suppressOutput: true };
}
