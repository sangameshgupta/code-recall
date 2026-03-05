export interface Migration {
  version: number;
  name: string;
  up: string[];
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'core_tables',
    up: [
      `CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        project TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        source TEXT NOT NULL DEFAULT 'compress',
        archive_path TEXT,
        archive_bytes INTEGER,
        archive_checksum TEXT,
        archived_at TEXT,
        metadata_json TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL,
        document_id TEXT UNIQUE,
        keywords TEXT,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        project TEXT NOT NULL,
        archive_basename TEXT,
        origin TEXT NOT NULL DEFAULT 'transcript',
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS overviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        project TEXT NOT NULL,
        origin TEXT NOT NULL DEFAULT 'claude',
        FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS diagnostics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        message TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'info',
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        project TEXT NOT NULL,
        origin TEXT NOT NULL DEFAULT 'system'
      )`,
      `CREATE TABLE IF NOT EXISTS transcript_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        project TEXT,
        event_index INTEGER NOT NULL,
        event_type TEXT,
        raw_json TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        captured_at_epoch INTEGER NOT NULL,
        UNIQUE(session_id, event_index)
      )`,
    ],
  },
  {
    version: 2,
    name: 'hierarchical_memory_fields',
    up: [
      `ALTER TABLE memories ADD COLUMN title TEXT`,
      `ALTER TABLE memories ADD COLUMN subtitle TEXT`,
      `ALTER TABLE memories ADD COLUMN facts TEXT`,
      `ALTER TABLE memories ADD COLUMN concepts TEXT`,
      `ALTER TABLE memories ADD COLUMN files_touched TEXT`,
    ],
  },
  {
    version: 3,
    name: 'pending_messages',
    up: [
      `CREATE TABLE IF NOT EXISTS pending_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT NOT NULL,
        message_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'claimed', 'processed', 'failed')),
        claimed_at TEXT,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_pending_messages_status ON pending_messages(status, created_at_epoch)`,
    ],
  },
  {
    version: 4,
    name: 'sdk_agent_architecture',
    up: [
      `CREATE TABLE IF NOT EXISTS sdk_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT UNIQUE NOT NULL,
        memory_session_id TEXT UNIQUE,
        project TEXT NOT NULL,
        user_prompt TEXT,
        started_at TEXT NOT NULL,
        started_at_epoch INTEGER NOT NULL,
        completed_at TEXT,
        completed_at_epoch INTEGER,
        status TEXT CHECK(status IN ('active', 'completed', 'failed')) NOT NULL DEFAULT 'active'
      )`,
      `CREATE TABLE IF NOT EXISTS observations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT NOT NULL,
        project TEXT NOT NULL,
        text TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT,
        subtitle TEXT,
        narrative TEXT,
        facts TEXT,
        concepts TEXT,
        files_read TEXT,
        files_modified TEXT,
        content_hash TEXT,
        discovery_tokens INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_observations_session ON observations(memory_session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_observations_project ON observations(project)`,
      `CREATE INDEX IF NOT EXISTS idx_observations_hash ON observations(content_hash)`,
      `CREATE TABLE IF NOT EXISTS session_summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        memory_session_id TEXT UNIQUE NOT NULL,
        project TEXT NOT NULL,
        request TEXT,
        investigated TEXT,
        learned TEXT,
        completed TEXT,
        next_steps TEXT,
        files_read TEXT,
        files_edited TEXT,
        notes TEXT,
        discovery_tokens INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        FOREIGN KEY(memory_session_id) REFERENCES sdk_sessions(memory_session_id)
      )`,
    ],
  },
  {
    version: 5,
    name: 'user_prompts',
    up: [
      `CREATE TABLE IF NOT EXISTS user_prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_session_id TEXT NOT NULL,
        prompt_number INTEGER NOT NULL,
        prompt_text TEXT NOT NULL,
        project TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        UNIQUE(content_session_id, prompt_number)
      )`,
    ],
  },
  {
    version: 6,
    name: 'fts5_full_text_search',
    up: [
      // FTS5 virtual tables — created conditionally (see Database.ts probe)
      `CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
        title, subtitle, narrative, text, facts, concepts,
        content='observations', content_rowid='id'
      )`,
      `CREATE VIRTUAL TABLE IF NOT EXISTS session_summaries_fts USING fts5(
        request, investigated, learned, completed, next_steps, notes,
        content='session_summaries', content_rowid='id'
      )`,
      // Auto-sync triggers for observations
      `CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
        INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
        VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
      END`,
      `CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
        VALUES ('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
      END`,
      `CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
        INSERT INTO observations_fts(observations_fts, rowid, title, subtitle, narrative, text, facts, concepts)
        VALUES ('delete', old.id, old.title, old.subtitle, old.narrative, old.text, old.facts, old.concepts);
        INSERT INTO observations_fts(rowid, title, subtitle, narrative, text, facts, concepts)
        VALUES (new.id, new.title, new.subtitle, new.narrative, new.text, new.facts, new.concepts);
      END`,
      // Auto-sync triggers for session_summaries
      `CREATE TRIGGER IF NOT EXISTS summaries_ai AFTER INSERT ON session_summaries BEGIN
        INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
        VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
      END`,
      `CREATE TRIGGER IF NOT EXISTS summaries_ad AFTER DELETE ON session_summaries BEGIN
        INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
        VALUES ('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
      END`,
      `CREATE TRIGGER IF NOT EXISTS summaries_au AFTER UPDATE ON session_summaries BEGIN
        INSERT INTO session_summaries_fts(session_summaries_fts, rowid, request, investigated, learned, completed, next_steps, notes)
        VALUES ('delete', old.id, old.request, old.investigated, old.learned, old.completed, old.next_steps, old.notes);
        INSERT INTO session_summaries_fts(rowid, request, investigated, learned, completed, next_steps, notes)
        VALUES (new.id, new.request, new.investigated, new.learned, new.completed, new.next_steps, new.notes);
      END`,
    ],
  },
  {
    version: 7,
    name: 'migration_tracking',
    up: [
      // discovery_tokens already added in migration 4 table definitions
      // This migration exists for forward compat if columns were added later
      `SELECT 1`, // no-op
    ],
  },
];
