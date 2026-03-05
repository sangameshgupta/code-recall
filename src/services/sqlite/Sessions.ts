import type { CodeRecallDatabase } from './Database.js';
import type { SdkSession } from '../../types/database.js';

export class SessionsStore {
  constructor(private db: CodeRecallDatabase) {}

  /**
   * Create a new SDK session.
   * contentSessionId comes from the Claude Code hook context.
   * memorySessionId starts as NULL — captured from first SDK agent response.
   */
  create(contentSessionId: string, project: string, userPrompt?: string): SdkSession {
    const now = new Date();
    this.db.run(
      `INSERT OR IGNORE INTO sdk_sessions
       (content_session_id, project, user_prompt, started_at, started_at_epoch, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [contentSessionId, project, userPrompt ?? null, now.toISOString(), Math.floor(now.getTime() / 1000)]
    );

    return this.getByContentSessionId(contentSessionId)!;
  }

  getByContentSessionId(contentSessionId: string): SdkSession | null {
    return this.db.queryOne<SdkSession>(
      'SELECT * FROM sdk_sessions WHERE content_session_id = ?',
      [contentSessionId]
    );
  }

  getByMemorySessionId(memorySessionId: string): SdkSession | null {
    return this.db.queryOne<SdkSession>(
      'SELECT * FROM sdk_sessions WHERE memory_session_id = ?',
      [memorySessionId]
    );
  }

  /**
   * Capture the memorySessionId from the SDK agent's first response.
   * This is the ONLY time memorySessionId should be set.
   */
  setMemorySessionId(contentSessionId: string, memorySessionId: string): void {
    this.db.run(
      'UPDATE sdk_sessions SET memory_session_id = ? WHERE content_session_id = ? AND memory_session_id IS NULL',
      [memorySessionId, contentSessionId]
    );
  }

  /**
   * Mark session as completed
   */
  complete(contentSessionId: string): void {
    const now = new Date();
    this.db.run(
      `UPDATE sdk_sessions SET status = 'completed', completed_at = ?, completed_at_epoch = ?
       WHERE content_session_id = ?`,
      [now.toISOString(), Math.floor(now.getTime() / 1000), contentSessionId]
    );
  }

  /**
   * Mark session as failed
   */
  fail(contentSessionId: string): void {
    const now = new Date();
    this.db.run(
      `UPDATE sdk_sessions SET status = 'failed', completed_at = ?, completed_at_epoch = ?
       WHERE content_session_id = ?`,
      [now.toISOString(), Math.floor(now.getTime() / 1000), contentSessionId]
    );
  }

  /**
   * Get active sessions (for stale session reaping)
   */
  getActiveSessions(): SdkSession[] {
    return this.db.queryAll<SdkSession>(
      "SELECT * FROM sdk_sessions WHERE status = 'active' ORDER BY started_at_epoch DESC"
    );
  }

  /**
   * Get recent sessions for a project
   */
  getRecentByProject(project: string, limit: number = 10): SdkSession[] {
    return this.db.queryAll<SdkSession>(
      'SELECT * FROM sdk_sessions WHERE project = ? ORDER BY started_at_epoch DESC LIMIT ?',
      [project, limit]
    );
  }
}
