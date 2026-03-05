import { createHash } from 'crypto';
import type { CodeRecallDatabase } from './Database.js';
import type { Observation } from '../../types/database.js';

export class ObservationsStore {
  constructor(private db: CodeRecallDatabase) {}

  /**
   * Store an observation with content-hash deduplication.
   * Returns the observation ID, or null if it was a duplicate.
   */
  insert(obs: {
    memorySessionId: string;
    project: string;
    text: string;
    type: string;
    title?: string;
    subtitle?: string;
    narrative?: string;
    facts?: string[];
    concepts?: string[];
    filesRead?: string[];
    filesModified?: string[];
  }): number | null {
    // Content-hash deduplication (SHA-256)
    const hashInput = `${obs.type}|${obs.title ?? ''}|${obs.narrative ?? ''}|${(obs.facts ?? []).join(',')}`;
    const contentHash = createHash('sha256').update(hashInput).digest('hex');

    // Check for duplicate
    const existing = this.db.queryOne<{ id: number }>(
      'SELECT id FROM observations WHERE content_hash = ?',
      [contentHash]
    );
    if (existing) return null;

    const now = new Date();
    this.db.run(
      `INSERT INTO observations
       (memory_session_id, project, text, type, title, subtitle, narrative, facts, concepts,
        files_read, files_modified, content_hash, created_at, created_at_epoch)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        obs.memorySessionId,
        obs.project,
        obs.text,
        obs.type,
        obs.title ?? null,
        obs.subtitle ?? null,
        obs.narrative ?? null,
        obs.facts ? JSON.stringify(obs.facts) : null,
        obs.concepts ? JSON.stringify(obs.concepts) : null,
        obs.filesRead ? JSON.stringify(obs.filesRead) : null,
        obs.filesModified ? JSON.stringify(obs.filesModified) : null,
        contentHash,
        now.toISOString(),
        Math.floor(now.getTime() / 1000),
      ]
    );

    const inserted = this.db.queryOne<{ id: number }>(
      'SELECT id FROM observations WHERE content_hash = ?',
      [contentHash]
    );
    return inserted?.id ?? null;
  }

  getById(id: number): Observation | null {
    return this.db.queryOne<Observation>('SELECT * FROM observations WHERE id = ?', [id]);
  }

  getByIds(ids: number[]): Observation[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return this.db.queryAll<Observation>(
      `SELECT * FROM observations WHERE id IN (${placeholders}) ORDER BY created_at_epoch DESC`,
      ids
    );
  }

  getByMemorySessionId(memorySessionId: string): Observation[] {
    return this.db.queryAll<Observation>(
      'SELECT * FROM observations WHERE memory_session_id = ? ORDER BY created_at_epoch ASC',
      [memorySessionId]
    );
  }

  /**
   * Get recent observations for a project (for context injection)
   */
  getRecentByProject(project: string, limit: number = 50): Observation[] {
    return this.db.queryAll<Observation>(
      'SELECT * FROM observations WHERE project = ? ORDER BY created_at_epoch DESC LIMIT ?',
      [project, limit]
    );
  }

  /**
   * Full-text search via FTS5
   */
  searchFts(query: string, project?: string, limit: number = 20): Observation[] {
    if (!this.db.hasFts5) {
      return this.searchLike(query, project, limit);
    }

    const baseQuery = `
      SELECT o.* FROM observations o
      JOIN observations_fts fts ON o.id = fts.rowid
      WHERE observations_fts MATCH ?
      ${project ? 'AND o.project = ?' : ''}
      ORDER BY rank
      LIMIT ?
    `;

    const params = project ? [query, project, limit] : [query, limit];
    return this.db.queryAll<Observation>(baseQuery, params);
  }

  /**
   * Fallback LIKE search when FTS5 is unavailable
   */
  private searchLike(query: string, project?: string, limit: number = 20): Observation[] {
    const pattern = `%${query}%`;
    const baseQuery = `
      SELECT * FROM observations
      WHERE (text LIKE ? OR title LIKE ? OR narrative LIKE ? OR facts LIKE ?)
      ${project ? 'AND project = ?' : ''}
      ORDER BY created_at_epoch DESC
      LIMIT ?
    `;

    const params = project
      ? [pattern, pattern, pattern, pattern, project, limit]
      : [pattern, pattern, pattern, pattern, limit];
    return this.db.queryAll<Observation>(baseQuery, params);
  }

  /**
   * Count observations per project
   */
  countByProject(project: string): number {
    const result = this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM observations WHERE project = ?',
      [project]
    );
    return result?.count ?? 0;
  }

  /**
   * Get total observation count
   */
  countAll(): number {
    const result = this.db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM observations');
    return result?.count ?? 0;
  }
}
