import type { HookEventData } from '../types.js';

/**
 * Adapter for Claude Code hook stdin format.
 * Normalizes Claude Code's event data into our internal format.
 */
export function adaptClaudeCodeEvent(raw: unknown): HookEventData | null {
  if (!raw || typeof raw !== 'object') return null;

  const data = raw as Record<string, unknown>;

  return {
    hook_event: data.hook_event as string | undefined,
    tool_name: data.tool_name as string | undefined,
    tool_input: data.tool_input as Record<string, unknown> | undefined,
    tool_output: typeof data.tool_output === 'string' ? data.tool_output : undefined,
    session_id: data.session_id as string | undefined,
    project_dir: data.project_dir as string | undefined,
    stop_reason: data.stop_reason as string | undefined,
    prompt: data.prompt as string | undefined,
    ...data,
  };
}

/**
 * Extract the content session ID from Claude Code hook data.
 * This is the session_id provided by Claude Code in the hook context.
 * CRITICAL: This is contentSessionId — used for STORAGE, never for resume.
 */
export function extractContentSessionId(event: HookEventData): string | null {
  return event.session_id ?? null;
}

/**
 * Extract project name from hook data.
 * Falls back to project detection from cwd.
 */
export function extractProject(event: HookEventData): string | null {
  if (event.project_dir) {
    // Use directory name as project identifier
    const parts = (event.project_dir as string).split('/');
    return parts[parts.length - 1] || null;
  }
  return null;
}
