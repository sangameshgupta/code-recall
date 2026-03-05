/** Hook event data from Claude Code stdin */
export interface HookEventData {
  hook_event?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  session_id?: string;
  project_dir?: string;
  stop_reason?: string;
  prompt?: string;
  [key: string]: unknown;
}

/** Hook response sent to Claude Code stdout */
export interface HookResponse {
  continue: boolean;
  suppressOutput?: boolean;
  decision?: 'approve' | 'deny' | 'block';
  reason?: string;
  message?: string;
  status?: 'ready' | 'error';
}

/** Supported hook actions */
export type HookAction =
  | 'context'
  | 'session-init'
  | 'observation'
  | 'summarize'
  | 'session-complete';

/** Adapter type for different CLI environments */
export type AdapterType = 'claude-code' | 'cursor' | 'raw';
