import type { CodeRecallDatabase } from './Database.js';
import type { PendingMessage } from '../../types/database.js';

export class PendingMessageStore {
  constructor(private db: CodeRecallDatabase) {}

  /**
   * Enqueue a new pending message
   */
  enqueue(contentSessionId: string, messageType: string, payload: string): number {
    const now = new Date();
    this.db.run(
      `INSERT INTO pending_messages (content_session_id, message_type, payload, status, created_at, created_at_epoch)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
      [contentSessionId, messageType, payload, now.toISOString(), Math.floor(now.getTime() / 1000)]
    );

    const inserted = this.db.queryOne<{ id: number }>(
      'SELECT last_insert_rowid() as id'
    );
    return inserted?.id ?? 0;
  }

  /**
   * Claim the next pending message for processing.
   * Uses atomic UPDATE + SELECT to prevent race conditions.
   */
  claimNext(contentSessionId: string): PendingMessage | null {
    const now = new Date().toISOString();

    // Claim oldest pending message for this session
    this.db.run(
      `UPDATE pending_messages
       SET status = 'claimed', claimed_at = ?
       WHERE id = (
         SELECT id FROM pending_messages
         WHERE content_session_id = ? AND status = 'pending'
         ORDER BY created_at_epoch ASC
         LIMIT 1
       )`,
      [now, contentSessionId]
    );

    // Return the claimed message
    return this.db.queryOne<PendingMessage>(
      `SELECT * FROM pending_messages
       WHERE content_session_id = ? AND status = 'claimed'
       ORDER BY claimed_at DESC
       LIMIT 1`,
      [contentSessionId]
    );
  }

  /**
   * Confirm a message was successfully processed
   */
  confirm(messageId: number): void {
    this.db.run(
      "UPDATE pending_messages SET status = 'processed' WHERE id = ?",
      [messageId]
    );
  }

  /**
   * Mark a message as failed
   */
  fail(messageId: number): void {
    this.db.run(
      "UPDATE pending_messages SET status = 'failed' WHERE id = ?",
      [messageId]
    );
  }

  /**
   * Re-queue stale claimed messages (claimed > 5 minutes ago but not confirmed)
   */
  requeueStale(staleThresholdMs: number = 5 * 60 * 1000): number {
    const cutoff = new Date(Date.now() - staleThresholdMs).toISOString();
    this.db.run(
      `UPDATE pending_messages
       SET status = 'pending', claimed_at = NULL
       WHERE status = 'claimed' AND claimed_at < ?`,
      [cutoff]
    );

    const result = this.db.queryOne<{ count: number }>(
      "SELECT changes() as count"
    );
    return result?.count ?? 0;
  }

  /**
   * Count pending messages for a session
   */
  countPending(contentSessionId: string): number {
    const result = this.db.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM pending_messages WHERE content_session_id = ? AND status = 'pending'",
      [contentSessionId]
    );
    return result?.count ?? 0;
  }

  /**
   * Check if any messages are pending or being processed for a session
   */
  hasUnprocessed(contentSessionId: string): boolean {
    const result = this.db.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM pending_messages WHERE content_session_id = ? AND status IN ('pending', 'claimed')",
      [contentSessionId]
    );
    return (result?.count ?? 0) > 0;
  }
}
