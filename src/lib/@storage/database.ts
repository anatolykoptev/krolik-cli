/**
 * @module lib/@storage/database
 * @description SQLite database manager for storage system (memory + docs cache)
 *
 * Supports hybrid memory architecture:
 * - Global database (~/.krolik/memory/global.db): patterns, library docs, snippets
 * - Project database ({project}/.krolik/memory/krolik.db): decisions, bugs, features
 *
 * Phase 1: Single global DB with proper project filtering
 * Phase 2: Split into global + per-project DBs (TODO)
 */

import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import Database, { type Statement } from 'better-sqlite3';

import { ensureDir } from '../@core/fs';

// ============================================================================
// TYPES
// ============================================================================

export type DatabaseScope = 'global' | 'project';

export interface DatabaseOptions {
  /** Database scope: 'global' for ~/.krolik, 'project' for {projectPath}/.krolik */
  scope?: DatabaseScope;
  /** Required for 'project' scope - absolute path to project root */
  projectPath?: string;
}

// ============================================================================
// DATABASE PATHS
// ============================================================================

/**
 * Get global memory directory (~/.krolik/memory)
 */
function getGlobalMemoryDir(): string {
  const dir = path.join(homedir(), '.krolik', 'memory');
  ensureDir(dir);
  return dir;
}

/**
 * Legacy global DB path (memories.db) - used for backward compatibility
 */
function getLegacyGlobalDbPath(): string {
  return path.join(getGlobalMemoryDir(), 'memories.db');
}

/**
 * Get project memory directory ({projectPath}/.krolik/memory)
 */
function getProjectMemoryDir(projectPath: string): string {
  const dir = path.join(projectPath, '.krolik', 'memory');
  ensureDir(dir);
  return dir;
}

/**
 * Get project database path ({projectPath}/.krolik/memory/krolik.db)
 */
function getProjectDbPath(projectPath: string): string {
  return path.join(getProjectMemoryDir(projectPath), 'krolik.db');
}

/**
 * Get the effective database path based on options
 *
 * - scope: 'global' or undefined - uses ~/.krolik/memory/memories.db
 * - scope: 'project' - uses {projectPath}/.krolik/memory/krolik.db
 */
function getEffectiveDbPath(options?: DatabaseOptions): string {
  if (options?.scope === 'project' && options.projectPath) {
    return getProjectDbPath(options.projectPath);
  }
  // Default to global DB
  return getLegacyGlobalDbPath();
}

// ============================================================================
// DATABASE INSTANCE CACHE
// ============================================================================

/**
 * Cache for prepared statements to avoid re-preparing the same SQL
 * Key format: `${dbPath}:${sql}`
 */
const stmtCache = new Map<string, Statement<unknown[], unknown>>();

/** Database instances cache (keyed by path) */
const dbInstances = new Map<string, Database.Database>();

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
  // Use db.name (file path) as part of the key for multi-db support
  const cacheKey = `${db.name}:${sql}`;
  let stmt = stmtCache.get(cacheKey);
  if (!stmt) {
    stmt = db.prepare(sql);
    stmtCache.set(cacheKey, stmt);
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
const CURRENT_VERSION = 10;

// ============================================================================
// DATABASE ACCESS
// ============================================================================

/**
 * Get or create database instance
 *
 * @param options - Database options (scope, projectPath)
 * @returns Database instance
 *
 * Phase 1: Always returns global database (backward compatible)
 * Phase 2: Will return appropriate database based on scope
 */
export function getDatabase(options?: DatabaseOptions): Database.Database {
  const dbPath = getEffectiveDbPath(options);

  // Check cache
  const cached = dbInstances.get(dbPath);
  if (cached) {
    return cached;
  }

  // Ensure directory exists
  const dbDir = path.dirname(dbPath);
  ensureDir(dbDir);

  // Create new database instance
  const db = new Database(dbPath);

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Run migrations
  runMigrations(db);

  // Cache instance
  dbInstances.set(dbPath, db);

  return db;
}

/**
 * Get global database instance
 * Convenience method for global memory operations
 */
export function getGlobalDatabase(): Database.Database {
  return getDatabase({ scope: 'global' });
}

/**
 * Get project database instance
 * Convenience method for project-scoped memory operations
 *
 * @param projectPath - Absolute path to project root
 */
export function getProjectDatabase(projectPath: string): Database.Database {
  return getDatabase({ scope: 'project', projectPath });
}

/**
 * Close database connection
 *
 * @param options - Database options to identify which DB to close
 *                  If not provided, closes all databases
 */
export function closeDatabase(options?: DatabaseOptions): void {
  if (options) {
    const dbPath = getEffectiveDbPath(options);
    const db = dbInstances.get(dbPath);
    if (db) {
      db.close();
      dbInstances.delete(dbPath);

      // Clear statement cache for this database
      for (const key of stmtCache.keys()) {
        if (key.startsWith(`${dbPath}:`)) {
          stmtCache.delete(key);
        }
      }
    }
  } else {
    // Close all databases
    clearStatementCache();
    for (const [dbPath, db] of dbInstances) {
      db.close();
      dbInstances.delete(dbPath);
    }
  }
}

/**
 * Close all database connections
 */
export function closeAllDatabases(): void {
  closeDatabase();
}

// ============================================================================
// SCHEMA MIGRATIONS
// ============================================================================

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

  // Migration 5: Hybrid memory architecture
  if (currentVersion < 5) {
    db.exec(`
      -- Add scope field to memories (project vs global)
      ALTER TABLE memories ADD COLUMN scope TEXT DEFAULT 'project'
        CHECK(scope IN ('project', 'global'));

      -- Add source field (where this knowledge came from)
      ALTER TABLE memories ADD COLUMN source TEXT DEFAULT 'manual'
        CHECK(source IN ('manual', 'context7', 'ai-generated', 'promoted'));

      -- Add usage tracking for relevance
      ALTER TABLE memories ADD COLUMN usage_count INTEGER DEFAULT 0;
      ALTER TABLE memories ADD COLUMN last_used_at TEXT;

      -- Add original reference for promoted memories
      ALTER TABLE memories ADD COLUMN original_project TEXT;
      ALTER TABLE memories ADD COLUMN original_id INTEGER;

      -- Index for scope filtering
      CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
      CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source);
      CREATE INDEX IF NOT EXISTS idx_memories_scope_type ON memories(scope, type);
    `);

    // Record migration
    const insertVersionSql = 'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)';
    prepareStatement<[number, string]>(db, insertVersionSql).run(5, new Date().toISOString());
  }

  // Migration 6: Semantic search embeddings and memory graph
  if (currentVersion < 6) {
    db.exec(`
      -- Memory embeddings table for semantic search
      -- Stores 384-dimensional vectors from all-MiniLM-L6-v2
      -- Note: sqlite-vec extension creates the actual vec0 virtual table
      -- This is a regular table that stores embeddings as BLOBs
      CREATE TABLE IF NOT EXISTS memory_embeddings (
        memory_id INTEGER PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Memory links table for graph relationships
      CREATE TABLE IF NOT EXISTS memory_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        to_id INTEGER NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
        link_type TEXT NOT NULL CHECK(link_type IN (
          'caused',      -- This memory caused/led to the linked memory
          'related',     -- General relationship
          'supersedes',  -- This memory replaces the linked memory
          'implements',  -- This memory implements the linked decision
          'contradicts'  -- This memory contradicts the linked memory
        )),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(from_id, to_id, link_type)
      );

      -- Indexes for memory graph traversal
      CREATE INDEX IF NOT EXISTS idx_memory_links_from ON memory_links(from_id);
      CREATE INDEX IF NOT EXISTS idx_memory_links_to ON memory_links(to_id);
      CREATE INDEX IF NOT EXISTS idx_memory_links_type ON memory_links(link_type);
    `);

    // Record migration
    const insertVersionSql = 'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)';
    prepareStatement<[number, string]>(db, insertVersionSql).run(6, new Date().toISOString());
  }

  // Migration 7: Krolik Felix tables (attempts, guardrails, sessions)
  if (currentVersion < 7) {
    db.exec(`
      -- Krolik Felix task attempts (execution history)
      CREATE TABLE IF NOT EXISTS felix_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        prd_task_id TEXT NOT NULL,
        attempt_number INTEGER NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        success INTEGER NOT NULL DEFAULT 0,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        model TEXT,
        error_message TEXT,
        error_stack TEXT,
        files_modified TEXT DEFAULT '[]',
        commands_executed TEXT DEFAULT '[]',
        commit_sha TEXT,
        validation_passed INTEGER DEFAULT 0,
        validation_output TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_felix_attempts_task ON felix_attempts(task_id);
      CREATE INDEX IF NOT EXISTS idx_felix_attempts_prd_task ON felix_attempts(prd_task_id);
      CREATE INDEX IF NOT EXISTS idx_felix_attempts_started ON felix_attempts(started_at DESC);

      -- Krolik Felix guardrails (lessons learned from failures)
      CREATE TABLE IF NOT EXISTS felix_guardrails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN (
          'code-quality', 'testing', 'security', 'dependencies',
          'performance', 'architecture', 'api', 'database',
          'typescript', 'react', 'other'
        )),
        severity TEXT NOT NULL DEFAULT 'medium' CHECK(severity IN ('critical', 'high', 'medium', 'low')),
        title TEXT NOT NULL,
        problem TEXT NOT NULL,
        solution TEXT NOT NULL,
        example TEXT,
        tags TEXT DEFAULT '[]',
        related_tasks TEXT DEFAULT '[]',
        usage_count INTEGER DEFAULT 0,
        last_used_at TEXT,
        superseded_by INTEGER REFERENCES felix_guardrails(id),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_felix_guardrails_project ON felix_guardrails(project);
      CREATE INDEX IF NOT EXISTS idx_felix_guardrails_category ON felix_guardrails(category);
      CREATE INDEX IF NOT EXISTS idx_felix_guardrails_severity ON felix_guardrails(severity);

      -- FTS5 for guardrails search
      CREATE VIRTUAL TABLE IF NOT EXISTS felix_guardrails_fts USING fts5(
        title,
        problem,
        solution,
        tags_text,
        content='felix_guardrails',
        content_rowid='id',
        tokenize='porter unicode61'
      );

      -- Triggers for guardrails FTS sync
      CREATE TRIGGER IF NOT EXISTS felix_guardrails_ai AFTER INSERT ON felix_guardrails BEGIN
        INSERT INTO felix_guardrails_fts(rowid, title, problem, solution, tags_text)
        VALUES (new.id, new.title, new.problem, new.solution,
                REPLACE(REPLACE(new.tags, '[', ''), ']', ''));
      END;

      CREATE TRIGGER IF NOT EXISTS felix_guardrails_ad AFTER DELETE ON felix_guardrails BEGIN
        INSERT INTO felix_guardrails_fts(felix_guardrails_fts, rowid, title, problem, solution, tags_text)
        VALUES('delete', old.id, old.title, old.problem, old.solution,
               REPLACE(REPLACE(old.tags, '[', ''), ']', ''));
      END;

      CREATE TRIGGER IF NOT EXISTS felix_guardrails_au AFTER UPDATE ON felix_guardrails BEGIN
        INSERT INTO felix_guardrails_fts(felix_guardrails_fts, rowid, title, problem, solution, tags_text)
        VALUES('delete', old.id, old.title, old.problem, old.solution,
               REPLACE(REPLACE(old.tags, '[', ''), ']', ''));
        INSERT INTO felix_guardrails_fts(rowid, title, problem, solution, tags_text)
        VALUES (new.id, new.title, new.problem, new.solution,
                REPLACE(REPLACE(new.tags, '[', ''), ']', ''));
      END;

      -- Krolik Felix sessions (high-level session tracking)
      CREATE TABLE IF NOT EXISTS felix_sessions (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        prd_path TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'paused', 'completed', 'failed', 'cancelled')),
        total_tasks INTEGER DEFAULT 0,
        completed_tasks INTEGER DEFAULT 0,
        failed_tasks INTEGER DEFAULT 0,
        skipped_tasks INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        total_cost_usd REAL DEFAULT 0,
        current_task_id TEXT,
        config TEXT DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_felix_sessions_project ON felix_sessions(project);
      CREATE INDEX IF NOT EXISTS idx_felix_sessions_status ON felix_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_felix_sessions_started ON felix_sessions(started_at DESC);
    `);

    prepareStatement<[number, string]>(
      db,
      'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)',
    ).run(7, new Date().toISOString());
  }

  // Migration 8: Library mappings and topics for docs cache
  if (currentVersion < 8) {
    db.exec(`
      -- Library name mappings (npm package -> context7 library)
      CREATE TABLE IF NOT EXISTS library_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        npm_name TEXT NOT NULL UNIQUE,
        context7_id TEXT NOT NULL,
        context7_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_library_mappings_npm ON library_mappings(npm_name);

      -- Library topics for targeted documentation fetching
      CREATE TABLE IF NOT EXISTS library_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        library_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        fetched_at TEXT,
        snippets_count INTEGER DEFAULT 0,
        FOREIGN KEY (library_id) REFERENCES library_docs(library_id) ON DELETE CASCADE,
        UNIQUE(library_id, topic)
      );

      CREATE INDEX IF NOT EXISTS idx_library_topics_library ON library_topics(library_id);
    `);

    prepareStatement<[number, string]>(
      db,
      'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)',
    ).run(8, new Date().toISOString());
  }

  // Migration 9: Felix ADK integration tables (consolidate separate DBs)
  if (currentVersion < 9) {
    db.exec(`
      -- Felix ADK sessions (ADK-compatible session storage, replaces felix-sessions.db)
      CREATE TABLE IF NOT EXISTS ralph_adk_sessions (
        id TEXT PRIMARY KEY,
        app_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        state TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_ralph_adk_sessions_app_user ON ralph_adk_sessions(app_name, user_id);

      -- Felix ADK events (conversation history for ADK runner)
      CREATE TABLE IF NOT EXISTS ralph_adk_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        invocation_id TEXT NOT NULL,
        author TEXT,
        content TEXT,
        actions TEXT DEFAULT '{}',
        branch TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES ralph_adk_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ralph_adk_events_session ON ralph_adk_events(session_id);
      CREATE INDEX IF NOT EXISTS idx_ralph_adk_events_timestamp ON ralph_adk_events(session_id, timestamp);

      -- Ralph checkpoints (crash recovery, replaces felix-checkpoints.db)
      CREATE TABLE IF NOT EXISTS ralph_checkpoints (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        prd_path TEXT NOT NULL,
        prd_hash TEXT NOT NULL,
        state TEXT NOT NULL,
        task_results TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_ralph_checkpoints_prd ON ralph_checkpoints(prd_path);
      CREATE INDEX IF NOT EXISTS idx_ralph_checkpoints_session ON ralph_checkpoints(session_id);
    `);

    prepareStatement<[number, string]>(
      db,
      'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)',
    ).run(9, new Date().toISOString());
  }

  // Migration 10: Model router patterns and attempt routing fields
  if (currentVersion < 10) {
    db.exec(`
      -- Add routing fields to felix_attempts
      ALTER TABLE felix_attempts ADD COLUMN signature_hash TEXT;
      ALTER TABLE felix_attempts ADD COLUMN escalated_from TEXT;

      -- Model routing patterns (learning from history)
      CREATE TABLE IF NOT EXISTS felix_routing_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        signature_hash TEXT NOT NULL,
        model TEXT NOT NULL,
        success_count INTEGER DEFAULT 0,
        fail_count INTEGER DEFAULT 0,
        avg_cost REAL DEFAULT 0,
        last_updated TEXT NOT NULL,
        UNIQUE(signature_hash, model)
      );

      CREATE INDEX IF NOT EXISTS idx_routing_patterns_signature ON felix_routing_patterns(signature_hash);
      CREATE INDEX IF NOT EXISTS idx_routing_patterns_model ON felix_routing_patterns(model);
    `);

    prepareStatement<[number, string]>(
      db,
      'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)',
    ).run(10, new Date().toISOString());
  }

  // Migration 11: Rename ralph_* tables to felix_* for rebrand
  if (currentVersion < 11) {
    // Check if ralph tables exist before renaming
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ralph_%'")
      .all() as Array<{ name: string }>;

    for (const { name } of tables) {
      const newName = name.replace('ralph_', 'felix_');
      try {
        db.prepare(`ALTER TABLE ${name} RENAME TO ${newName}`).run();
      } catch (error) {
        // Table might already be renamed, continue
        if (process.env.DEBUG) {
          console.error(`Failed to rename ${name} to ${newName}:`, error);
        }
      }
    }

    prepareStatement<[number, string]>(
      db,
      'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)',
    ).run(11, new Date().toISOString());
  }
}

// ============================================================================
// DIAGNOSTICS
// ============================================================================

/**
 * Get database path (for diagnostics)
 *
 * @param options - Database options
 */
export function getDatabasePath(options?: DatabaseOptions): string {
  return getEffectiveDbPath(options);
}

/**
 * Get database stats
 *
 * @param options - Database options
 */
export function getDatabaseStats(options?: DatabaseOptions): {
  path: string;
  size: number;
  memoriesCount: number;
  schemaVersion: number;
} {
  const db = getDatabase(options);
  const dbPath = getEffectiveDbPath(options);
  const stats = fs.statSync(dbPath);

  const countSql = 'SELECT COUNT(*) as count FROM memories';
  const countRow = prepareStatement<[], { count: number }>(db, countSql).get() as { count: number };

  const versionSql = 'SELECT MAX(version) as version FROM schema_versions';
  const versionRow = prepareStatement<[], { version: number | null }>(db, versionSql).get() as {
    version: number | null;
  };

  return {
    path: dbPath,
    size: stats.size,
    memoriesCount: countRow.count,
    schemaVersion: versionRow?.version ?? 0,
  };
}
