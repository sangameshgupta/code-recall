import type { HookEventData, HookResponse } from '../types.js';
import { DEFAULT_WORKER_PORT, WORKER_HOST } from '../../shared/paths.js';
import { SettingsDefaultsManager } from '../../shared/SettingsDefaultsManager.js';
import { extractContentSessionId, extractProject } from '../adapters/claude-code.js';
import { getProjectName } from '../../utils/project-name.js';

/**
 * Session init handler — called on UserPromptSubmit.
 * Creates or resumes an SDK session in the worker.
 */
export async function handleSessionInit(event: HookEventData): Promise<HookResponse> {
  const contentSessionId = extractContentSessionId(event);
  if (!contentSessionId) {
    return { continue: true, suppressOutput: true };
  }

  const project = extractProject(event) ?? getProjectName(event.project_dir as string | undefined);
  const userPrompt = event.prompt as string | undefined;

  const settings = SettingsDefaultsManager.loadFromFile();
  const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;

  try {
    const res = await fetch(`http://${WORKER_HOST}:${port}/api/sessions/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentSessionId, project, userPrompt }),
    });

    if (!res.ok) {
      console.error(`[code-recall] session-init failed: ${res.status}`);
    }
  } catch {
    // Worker not running — fail silently
  }

  return { continue: true, suppressOutput: true };
}
