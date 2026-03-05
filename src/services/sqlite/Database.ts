import { Database as BunDatabase } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { PATHS } from '../../shared/paths.js';
import { MIGRATIONS, type Migration } from './migrations.js';

export class CodeRecallDatabase {
  private db: BunDatabase;
  private fts5Available: boolean = false;

  constructor(dbPath: string = PATHS.database) {
    // Ensure directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    this.db = new BunDatabase(dbPath);
    this.configurePragmas();
    this.probeFts5();
    this.runMigrations();
  }

  private configurePragmas(): void {
    this.db.run('PRAGMA journal_mode = WAL');
    this.db.run('PRAGMA synchronous = NORMAL');
    this.db.run('PRAGMA foreign_keys = ON');
    this.db.run('PRAGMA temp_store = memory');
    this.db.run('PRAGMA mmap_size = 268435456'); // 256MB
    this.db.run('PRAGMA cache_size = 10000');
    this.db.run('PRAGMA busy_timeout = 5000'); // 5s retry on SQLITE_BUSY
  }

  /**
   * Probe FTS5 availability — some Bun builds (Windows) lack it.
   */
  private probeFts5(): void {
    try {
      this.db.run('CREATE VIRTUAL TABLE _fts5_probe USING fts5(test_column)');
      this.db.run('DROP TABLE _fts5_probe');
      this.fts5Available = true;
    } catch {
      this.fts5Available = false;
      console.error('[code-recall] FTS5 not available — search will use LIKE queries');
    }
  }

  private runMigrations(): void {
    // Create migration tracking table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const applied = new Set(
      this.db.query<{ version: number }, []>('SELECT version FROM _migrations')
        .all()
        .map(r => r.version)
    );

    for (const migration of MIGRATIONS) {
      if (applied.has(migration.version)) continue;

      // Skip FTS5 migrations if not available
      if (migration.version === 6 && !this.fts5Available) {
        this.recordMigration(migration, true);
        continue;
      }

      this.applyMigration(migration);
    }
  }

  private applyMigration(migration: Migration): void {
    const transaction = this.db.transaction(() => {
      for (const sql of migration.up) {
        try {
          this.db.run(sql);
        } catch (err) {
          // Some statements may fail on re-run (ALTER TABLE column already exists)
          // Log but continue
          console.error(`[migration ${migration.version}] ${(err as Error).message}`);
        }
      }
      this.recordMigration(migration, false);
    });

    transaction();
  }

  private recordMigration(migration: Migration, skipped: boolean): void {
    this.db.run(
      'INSERT OR REPLACE INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)',
      [migration.version, `${migration.name}${skipped ? ' (skipped)' : ''}`, new Date().toISOString()]
    );
  }

  /** Get the raw bun:sqlite Database instance */
  get raw(): BunDatabase {
    return this.db;
  }

  get hasFts5(): boolean {
    return this.fts5Available;
  }

  /**
   * Execute a function within a transaction
   */
  transaction<T>(fn: () => T): T {
    const txn = this.db.transaction(fn);
    return txn();
  }

  /**
   * Run a SQL statement
   */
  run(sql: string, params?: any[]): void {
    if (params) {
      this.db.run(sql, params);
    } else {
      this.db.run(sql);
    }
  }

  /**
   * Query and return all results
   */
  queryAll<T>(sql: string, params?: any[]): T[] {
    const stmt = this.db.query<T, any[]>(sql);
    return params ? stmt.all(...params) : stmt.all();
  }

  /**
   * Query and return first result
   */
  queryOne<T>(sql: string, params?: any[]): T | null {
    const stmt = this.db.query<T, any[]>(sql);
    return (params ? stmt.get(...params) : stmt.get()) ?? null;
  }

  close(): void {
    this.db.close();
  }
}
