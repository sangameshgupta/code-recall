import type { CodeRecallDatabase } from './Database.js';
import type { SessionSummary } from '../../types/database.js';

export class SummariesStore {
  constructor(private db: CodeRecallDatabase) {}

  insert(summary: {
    memorySessionId: string;
    project: string;
    request?: string;
    investigated?: string;
    learned?: string;
    completed?: string;
    nextSteps?: string;
    filesRead?: string;
    filesEdited?: string;
    notes?: string;
  }): number {
    const now = new Date();
    this.db.run(
      `INSERT OR REPLACE INTO session_summaries
       (memory_session_id, project, request, investigated, learned, completed,
        next_steps, files_read, files_edited, notes, created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        summary.memorySessionId,
        summary.project,
        summary.request ?? null,
        summary.investigated ?? null,
        summary.learned ?? null,
        summary.completed ?? null,
        summary.nextSteps ?? null,
        summary.filesRead ?? null,
        summary.filesEdited ?? null,
        summary.notes ?? null,
        now.toISOString(),
        Math.floor(now.getTime() / 1000),
      ]
    );

    const inserted = this.db.queryOne<{ id: number }>(
      'SELECT id FROM session_summaries WHERE memory_session_id = ?',
      [summary.memorySessionId]
    );
    return inserted?.id ?? 0;
  }

  getByMemorySessionId(memorySessionId: string): SessionSummary | null {
    return this.db.queryOne<SessionSummary>(
      'SELECT * FROM session_summaries WHERE memory_session_id = ?',
      [memorySessionId]
    );
  }

  getRecentByProject(project: string, limit: number = 10): SessionSummary[] {
    return this.db.queryAll<SessionSummary>(
      'SELECT * FROM session_summaries WHERE project = ? ORDER BY created_at_epoch DESC LIMIT ?',
      [project, limit]
    );
  }

  searchFts(query: string, project?: string, limit: number = 20): SessionSummary[] {
    if (!this.db.hasFts5) {
      return this.searchLike(query, project, limit);
    }

    const baseQuery = `
      SELECT s.* FROM session_summaries s
      JOIN session_summaries_fts fts ON s.id = fts.rowid
      WHERE session_summaries_fts MATCH ?
      ${project ? 'AND s.project = ?' : ''}
      ORDER BY rank
      LIMIT ?
    `;

    const params = project ? [query, project, limit] : [query, limit];
    return this.db.queryAll<SessionSummary>(baseQuery, params);
  }

  private searchLike(query: string, project?: string, limit: number = 20): SessionSummary[] {
    const pattern = `%${query}%`;
    const baseQuery = `
      SELECT * FROM session_summaries
      WHERE (request LIKE ? OR investigated LIKE ? OR learned LIKE ? OR completed LIKE ? OR notes LIKE ?)
      ${project ? 'AND project = ?' : ''}
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `;

    const params = project
      ? [pattern, pattern, pattern, pattern, pattern, project, limit]
      : [pattern, pattern, pattern, pattern, pattern, limit];
    return this.db.queryAll<SessionSummary>(baseQuery, params);
  }
}
