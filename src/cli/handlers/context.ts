import type { HookEventData, HookResponse } from '../types.js';
import { DEFAULT_WORKER_PORT, WORKER_HOST } from '../../shared/paths.js';
import { SettingsDefaultsManager } from '../../shared/SettingsDefaultsManager.js';
import { extractProject } from '../adapters/claude-code.js';
import { getProjectName } from '../../utils/project-name.js';

/**
 * Context handler — called on SessionStart to inject prior observations.
 * Fetches recent observations from worker API and injects as context block.
 */
export async function handleContext(event: HookEventData): Promise<HookResponse> {
  const settings = SettingsDefaultsManager.loadFromFile();
  const port = parseInt(settings.CODE_RECALL_WORKER_PORT, 10) || DEFAULT_WORKER_PORT;
  const project = extractProject(event) ?? getProjectName(event.project_dir as string | undefined);
  const limit = parseInt(settings.CODE_RECALL_CONTEXT_OBSERVATIONS, 10) || 50;

  try {
    // Check worker health first
    const healthRes = await fetch(`http://${WORKER_HOST}:${port}/api/health`);
    if (!healthRes.ok) {
      return { continue: true, suppressOutput: true };
    }

    const health = await healthRes.json() as { status: string; observations: number };
    if (health.observations === 0) {
      // No observations yet — inject welcome message
      return {
        continue: true,
        suppressOutput: true,
        message: `<code-recall-context>\n[code-recall] Memory system active. No prior observations for project "${project}" yet.\n</code-recall-context>`,
      };
    }

    // Fetch recent observations
    const obsRes = await fetch(
      `http://${WORKER_HOST}:${port}/api/observations/recent?project=${encodeURIComponent(project)}&limit=${limit}`
    );
    if (!obsRes.ok) {
      return { continue: true, suppressOutput: true };
    }

    const { observations } = await obsRes.json() as { observations: Array<Record<string, unknown>> };

    if (!observations || observations.length === 0) {
      return {
        continue: true,
        suppressOutput: true,
        message: `<code-recall-context>\n[code-recall] Memory active. No observations for "${project}" yet.\n</code-recall-context>`,
      };
    }

    // Build context block
    const contextLines: string[] = [
      `<code-recall-context>`,
      `# Code Recall — Session Context`,
      `**Project:** ${project}`,
      `**Observations:** ${observations.length} most recent`,
      ``,
    ];

    // Add recent summaries section
    try {
      const summRes = await fetch(
        `http://${WORKER_HOST}:${port}/api/timeline?project=${encodeURIComponent(project)}&limit=5`
      );
      if (summRes.ok) {
        const { timeline } = await summRes.json() as { timeline: Array<Record<string, unknown>> };
        if (timeline && timeline.length > 0) {
          contextLines.push(`## Recent Activity`);
          for (const obs of timeline.slice(0, 10)) {
            const type = obs.type as string ?? 'change';
            const title = obs.title as string ?? 'Untitled';
            const created = obs.created_at as string ?? '';
            contextLines.push(`- [${type}] ${title} (${created.split('T')[0]})`);
          }
          contextLines.push('');
        }
      }
    } catch {
      // Non-critical — continue without timeline
    }

    // Add observation details (most recent first, compact format)
    contextLines.push(`## Key Observations`);
    for (const obs of observations.slice(0, 20)) {
      const type = obs.type as string ?? 'change';
      const title = obs.title as string ?? 'Observation';
      const narrative = obs.narrative as string;
      const facts = obs.facts as string;

      contextLines.push(`### [${type}] ${title}`);
      if (narrative) contextLines.push(narrative);
      if (facts) {
        try {
          const factsList = JSON.parse(facts) as string[];
          for (const fact of factsList.slice(0, 5)) {
            contextLines.push(`- ${fact}`);
          }
        } catch {
          contextLines.push(facts);
        }
      }
      contextLines.push('');
    }

    contextLines.push(`</code-recall-context>`);

    // Token budget check (~4 chars per token)
    const tokenBudget = parseInt(settings.CODE_RECALL_CONTEXT_TOKEN_BUDGET, 10) || 8000;
    let contextText = contextLines.join('\n');
    const estimatedTokens = Math.ceil(contextText.length / 4);

    if (estimatedTokens > tokenBudget) {
      // Trim to budget — remove observations from the end
      const maxChars = tokenBudget * 4;
      contextText = contextText.slice(0, maxChars);
      // Find last complete observation and close the tag
      const lastNewline = contextText.lastIndexOf('\n###');
      if (lastNewline > 0) {
        contextText = contextText.slice(0, lastNewline);
      }
      contextText += '\n\n[...truncated for token budget]\n</code-recall-context>';
    }

    return {
      continue: true,
      suppressOutput: true,
      message: contextText,
    };
  } catch {
    // Worker not running or unreachable — fail silently
    return { continue: true, suppressOutput: true };
  }
}
