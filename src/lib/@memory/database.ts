/**
 * @module lib/@memory/database
 * @description SQLite database manager for memory system
 */

import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import Database from 'better-sqlite3';

const MEMORY_DIR = path.join(homedir(), '.krolik', 'memory');
const DB_PATH = path.join(MEMORY_DIR, 'memories.db');

let dbInstance: Database.Database | null = null;

/**
 * Current schema version
 */
const CURRENT_VERSION = 2;

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
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Get current schema version
 */
function getSchemaVersion(db: Database.Database): number {
  try {
    const row = db.prepare('SELECT MAX(version) as version FROM schema_versions').get() as
      | { version: number | null }
      | undefined;
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
    db.prepare('INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)').run(
      1,
      new Date().toISOString(),
    );
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
    db.prepare('INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)').run(
      2,
      new Date().toISOString(),
    );
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

  const countRow = db.prepare('SELECT COUNT(*) as count FROM memories').get() as { count: number };
  const versionRow = db.prepare('SELECT MAX(version) as version FROM schema_versions').get() as {
    version: number | null;
  };

  return {
    path: DB_PATH,
    size: stats.size,
    memoriesCount: countRow.count,
    schemaVersion: versionRow?.version ?? 0,
  };
}
