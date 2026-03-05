/** SDK session stored in database */
export interface SdkSession {
  id: number;
  content_session_id: string;
  memory_session_id: string | null;
  project: string;
  user_prompt: string | null;
  started_at: string;
  started_at_epoch: number;
  completed_at: string | null;
  completed_at_epoch: number | null;
  status: 'active' | 'completed' | 'failed';
}

/** Observation stored in database */
export interface Observation {
  id: number;
  memory_session_id: string;
  project: string;
  text: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  narrative: string | null;
  facts: string | null;
  concepts: string | null;
  files_read: string | null;
  files_modified: string | null;
  content_hash: string | null;
  discovery_tokens: number;
  created_at: string;
  created_at_epoch: number;
}

/** Session summary stored in database */
export interface SessionSummary {
  id: number;
  memory_session_id: string;
  project: string;
  request: string | null;
  investigated: string | null;
  learned: string | null;
  completed: string | null;
  next_steps: string | null;
  files_read: string | null;
  files_edited: string | null;
  notes: string | null;
  discovery_tokens: number;
  created_at: string;
  created_at_epoch: number;
}

/** Pending message in the queue */
export interface PendingMessage {
  id: number;
  content_session_id: string;
  message_type: string;
  payload: string;
  status: 'pending' | 'claimed' | 'processed' | 'failed';
  claimed_at: string | null;
  created_at: string;
  created_at_epoch: number;
}

/** Legacy session (Migration 001) */
export interface Session {
  id: number;
  session_id: string;
  project: string;
  created_at: string;
  created_at_epoch: number;
  source: string;
  metadata_json: string | null;
}
