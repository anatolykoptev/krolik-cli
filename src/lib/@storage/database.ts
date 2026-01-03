/**
 * @module lib/@storage/database
 * @description SQLite database manager for storage system (memory + docs cache)
 */

import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import Database, { type Statement } from 'better-sqlite3';

const MEMORY_DIR = path.join(homedir(), '.krolik', 'memory');
const DB_PATH = path.join(MEMORY_DIR, 'memories.db');

let dbInstance: Database.Database | null = null;

/**
 * Cache for prepared statements to avoid re-preparing the same SQL
 */
const stmtCache = new Map<string, Statement<unknown[], unknown>>();

/**
 * Get or create a prepared statement from cache
 * @param db - Database instance
 * @param sql - SQL query string
 * @returns Cached or newly prepared statement
 */
export function prepareStatement<BindParams extends unknown[] = unknown[], Result = unknown>(
  db: Database.Database,
  sql: string,
): Statement<BindParams, Result> {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt as Statement<BindParams, Result>;
}

/**
 * Clear the statement cache (useful for testing or when closing database)
 */
export function clearStatementCache(): void {
  stmtCache.clear();
}

/**
 * Current schema version
 */
const CURRENT_VERSION = 4;

/**
 * Ensure memory directory exists
 */
function ensureMemoryDir(): void {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Get or create database instance
 */
export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  ensureMemoryDir();

  dbInstance = new Database(DB_PATH);

  // Enable WAL mode for better concurrency
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(dbInstance);

  return dbInstance;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    // Clear statement cache before closing to avoid stale references
    clearStatementCache();
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Get current schema version
 */
function getSchemaVersion(db: Database.Database): number {
  try {
    const sql = 'SELECT MAX(version) as version FROM schema_versions';
    const stmt = prepareStatement<[], { version: number | null }>(db, sql);
    const row = stmt.get();
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Run all pending migrations
 */
function runMigrations(db: Database.Database): void {
  const currentVersion = getSchemaVersion(db);

  if (currentVersion >= CURRENT_VERSION) {
    return;
  }

  // Migration 1: Initial schema with FTS5
  if (currentVersion < 1) {
    db.exec(`
      -- Schema versions table
      CREATE TABLE IF NOT EXISTS schema_versions (
        id INTEGER PRIMARY KEY,
        version INTEGER UNIQUE NOT NULL,
        applied_at TEXT NOT NULL
      );

      -- Main memories table
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('observation', 'decision', 'pattern', 'bugfix', 'feature')),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        importance TEXT NOT NULL DEFAULT 'medium' CHECK(importance IN ('low', 'medium', 'high', 'critical')),
        project TEXT NOT NULL,
        branch TEXT,
        commit_hash TEXT,
        tags TEXT DEFAULT '[]',
        files TEXT DEFAULT '[]',
        features TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL
      );

      -- Indexes for filtering
      CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at_epoch DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_project_type ON memories(project, type);
      CREATE INDEX IF NOT EXISTS idx_memories_project_importance ON memories(project, importance);

      -- FTS5 virtual table for full-text search
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        title,
        description,
        tags_text,
        features_text,
        content='memories',
        content_rowid='id',
        tokenize='porter unicode61'
      );

      -- Triggers to keep FTS in sync
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
        SELECT new.id, new.title, new.description,
               REPLACE(REPLACE(new.tags, '[', ''), ']', ''),
               REPLACE(REPLACE(new.features, '[', ''), ']', '');
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, title, description, tags_text, features_text)
        VALUES('delete', old.id, old.title, old.description,
               REPLACE(REPLACE(old.tags, '[', ''), ']', ''),
               REPLACE(REPLACE(old.features, '[', ''), ']', ''));
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, title, description, tags_text, features_text)
        VALUES('delete', old.id, old.title, old.description,
               REPLACE(REPLACE(old.tags, '[', ''), ']', ''),
               REPLACE(REPLACE(old.features, '[', ''), ']', ''));
        INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
        SELECT new.id, new.title, new.description,
               REPLACE(REPLACE(new.tags, '[', ''), ']', ''),
               REPLACE(REPLACE(new.features, '[', ''), ']', '');
      END;
    `);

    // Record migration
    const insertVersionSql = 'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)';
    prepareStatement<[number, string]>(db, insertVersionSql).run(1, new Date().toISOString());
  }

  // Migration 2: Documentation cache tables
  if (currentVersion < 2) {
    db.exec(`
      -- Library documentation cache
      CREATE TABLE IF NOT EXISTS library_docs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library_id TEXT NOT NULL UNIQUE,
        library_name TEXT NOT NULL,
        version TEXT,
        fetched_at TEXT NOT NULL,
        fetched_at_epoch INTEGER NOT NULL,
        expires_at_epoch INTEGER NOT NULL,
        total_snippets INTEGER DEFAULT 0
      );

      -- Individual documentation sections
      CREATE TABLE IF NOT EXISTS doc_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library_id TEXT NOT NULL,
        topic TEXT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        code_snippets TEXT DEFAULT '[]',
        page_number INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (library_id) REFERENCES library_docs(library_id) ON DELETE CASCADE
      );

      -- Indexes for library docs
      CREATE INDEX IF NOT EXISTS idx_library_docs_name ON library_docs(library_name);
      CREATE INDEX IF NOT EXISTS idx_library_docs_expires ON library_docs(expires_at_epoch);
      CREATE INDEX IF NOT EXISTS idx_doc_sections_library ON doc_sections(library_id);
      CREATE INDEX IF NOT EXISTS idx_doc_sections_topic ON doc_sections(topic);

      -- FTS5 for documentation search
      CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
        title,
        content,
        topic,
        content='doc_sections',
        content_rowid='id',
        tokenize='porter unicode61'
      );

      -- Triggers for FTS sync
      CREATE TRIGGER IF NOT EXISTS docs_fts_ai AFTER INSERT ON doc_sections BEGIN
        INSERT INTO docs_fts(rowid, title, content, topic)
        VALUES (new.id, new.title, new.content, COALESCE(new.topic, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS docs_fts_ad AFTER DELETE ON doc_sections BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, title, content, topic)
        VALUES('delete', old.id, old.title, old.content, COALESCE(old.topic, ''));
      END;

      CREATE TRIGGER IF NOT EXISTS docs_fts_au AFTER UPDATE ON doc_sections BEGIN
        INSERT INTO docs_fts(docs_fts, rowid, title, content, topic)
        VALUES('delete', old.id, old.title, old.content, COALESCE(old.topic, ''));
        INSERT INTO docs_fts(rowid, title, content, topic)
        VALUES (new.id, new.title, new.content, COALESCE(new.topic, ''));
      END;
    `);

    // Record migration
    const insertVersionSql = 'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)';
    prepareStatement<[number, string]>(db, insertVersionSql).run(2, new Date().toISOString());
  }

  // Migration 3: Audit history table
  if (currentVersion < 3) {
    db.exec(`
      -- Audit history for trend tracking
      CREATE TABLE IF NOT EXISTS audit_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        timestamp_epoch INTEGER NOT NULL,
        commit_hash TEXT,
        branch TEXT,
        score INTEGER NOT NULL,
        grade TEXT NOT NULL CHECK(grade IN ('A', 'B', 'C', 'D', 'F')),
        total_issues INTEGER NOT NULL,
        critical_issues INTEGER NOT NULL DEFAULT 0,
        high_issues INTEGER NOT NULL DEFAULT 0,
        medium_issues INTEGER NOT NULL DEFAULT 0,
        low_issues INTEGER NOT NULL DEFAULT 0,
        files_analyzed INTEGER,
        duration_ms INTEGER
      );

      -- Indexes for audit history
      CREATE INDEX IF NOT EXISTS idx_audit_history_project ON audit_history(project);
      CREATE INDEX IF NOT EXISTS idx_audit_history_timestamp ON audit_history(timestamp_epoch DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_history_project_timestamp ON audit_history(project, timestamp_epoch DESC);
    `);

    // Record migration
    const insertVersionSql = 'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)';
    prepareStatement<[number, string]>(db, insertVersionSql).run(3, new Date().toISOString());
  }

  // Migration 4: Progress tracking (tasks, epics, sessions)
  if (currentVersion < 4) {
    db.exec(`
      -- Tasks table (GitHub issues + local + AI-generated)
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL CHECK(source IN ('github', 'local', 'ai-generated')),
        external_id TEXT,
        project TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog', 'in_progress', 'blocked', 'done', 'cancelled')),
        epic TEXT,
        priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('critical', 'high', 'medium', 'low')),
        blocked_by TEXT,
        labels TEXT DEFAULT '[]',
        assigned_session TEXT,
        linked_memories TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );

      -- Task indexes
      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_epic ON tasks(epic);
      CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project, status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_external ON tasks(project, source, external_id) WHERE external_id IS NOT NULL;

      -- Epics table (task groups)
      CREATE TABLE IF NOT EXISTS epics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        project TEXT NOT NULL,
        description TEXT,
        progress INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'planning' CHECK(status IN ('planning', 'in_progress', 'done', 'on_hold')),
        total_tasks INTEGER DEFAULT 0,
        completed_tasks INTEGER DEFAULT 0,
        started_at TEXT,
        completed_at TEXT,
        UNIQUE(project, name)
      );

      -- Epic indexes
      CREATE INDEX IF NOT EXISTS idx_epics_project ON epics(project);
      CREATE INDEX IF NOT EXISTS idx_epics_status ON epics(status);

      -- Sessions table (AI work sessions)
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        summary TEXT,
        tasks_worked_on TEXT DEFAULT '[]',
        tasks_completed TEXT DEFAULT '[]',
        commits TEXT DEFAULT '[]',
        memories_created TEXT DEFAULT '[]',
        files_modified TEXT DEFAULT '[]'
      );

      -- Session indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);
    `);

    // Record migration
    const insertVersionSql = 'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)';
    prepareStatement<[number, string]>(db, insertVersionSql).run(4, new Date().toISOString());
  }
}

/**
 * Get database path (for diagnostics)
 */
export function getDatabasePath(): string {
  return DB_PATH;
}

/**
 * Get database stats
 */
export function getDatabaseStats(): {
  path: string;
  size: number;
  memoriesCount: number;
  schemaVersion: number;
} {
  const db = getDatabase();
  const stats = fs.statSync(DB_PATH);

  const countSql = 'SELECT COUNT(*) as count FROM memories';
  const countRow = prepareStatement<[], { count: number }>(db, countSql).get() as { count: number };

  const versionSql = 'SELECT MAX(version) as version FROM schema_versions';
  const versionRow = prepareStatement<[], { version: number | null }>(db, versionSql).get() as {
    version: number | null;
  };

  return {
    path: DB_PATH,
    size: stats.size,
    memoriesCount: countRow.count,
    schemaVersion: versionRow?.version ?? 0,
  };
}
