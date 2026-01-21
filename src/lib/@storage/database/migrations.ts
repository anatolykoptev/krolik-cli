/**
 * @module lib/@storage/database/migrations
 * @description SQLite database migrations
 *
 * All schema migrations are contained in this file.
 * Each migration is idempotent and incremental.
 *
 * Migration Guidelines:
 * 1. Always use IF NOT EXISTS / IF EXISTS for safety
 * 2. Check column existence before ALTER TABLE
 * 3. Never modify existing migration code
 * 4. Add new migrations at the end with next version number
 */

import type { Database } from 'better-sqlite3';
import { prepareStatement } from './statements';

/**
 * Current schema version
 * IMPORTANT: Increment this when adding new migrations
 */
export const CURRENT_VERSION = 21;

/**
 * Get current schema version from database
 */
export function getSchemaVersion(db: Database): number {
  try {
    const sql = 'SELECT MAX(version) as version FROM schema_versions';
    const row = db.prepare(sql).get() as { version: number | null } | undefined;
    return row?.version ?? 0;
  } catch {
    // Table doesn't exist yet, return 0
    return 0;
  }
}

/**
 * Record migration version
 */
function recordMigration(db: Database, version: number): void {
  const sql = 'INSERT INTO schema_versions (version, applied_at) VALUES (?, ?)';
  prepareStatement<[number, string]>(db, sql).run(version, new Date().toISOString());
}

/**
 * Run all pending migrations
 *
 * Migrations are numbered sequentially from 1.
 * Each migration checks currentVersion and only runs if needed.
 */
export function runMigrations(db: Database): void {
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
        type TEXT NOT NULL CHECK(type IN ('observation', 'decision', 'pattern', 'bugfix', 'feature', 'library', 'snippet', 'anti-pattern')),
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

      -- FTS5 virtual table for full-text search (standalone)
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        title,
        description,
        tags_text,
        features_text,
        tokenize='porter unicode61'
      );

      -- Triggers to keep FTS in sync (standalone table)
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
        VALUES (new.id, new.title, new.description,
                REPLACE(REPLACE(new.tags, '[', ''), ']', ''),
                REPLACE(REPLACE(new.features, '[', ''), ']', ''));
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        DELETE FROM memories_fts WHERE rowid = old.id;
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        DELETE FROM memories_fts WHERE rowid = old.id;
        INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
        VALUES (new.id, new.title, new.description,
                REPLACE(REPLACE(new.tags, '[', ''), ']', ''),
                REPLACE(REPLACE(new.features, '[', ''), ']', ''));
      END;
    `);
    recordMigration(db, 1);
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
    recordMigration(db, 2);
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
    recordMigration(db, 3);
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
    recordMigration(db, 4);
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
    recordMigration(db, 5);
  }

  // Migration 6: Semantic search embeddings and memory graph
  if (currentVersion < 6) {
    db.exec(`
      -- Memory embeddings table for semantic search
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
          'caused',
          'related',
          'supersedes',
          'implements',
          'contradicts'
        )),
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(from_id, to_id, link_type)
      );

      -- Indexes for memory graph traversal
      CREATE INDEX IF NOT EXISTS idx_memory_links_from ON memory_links(from_id);
      CREATE INDEX IF NOT EXISTS idx_memory_links_to ON memory_links(to_id);
      CREATE INDEX IF NOT EXISTS idx_memory_links_type ON memory_links(link_type);
    `);
    recordMigration(db, 6);
  }

  // Migration 7: Krolik Felix tables
  if (currentVersion < 7) {
    db.exec(`
      -- Felix task attempts
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

      -- Felix guardrails
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

      -- Felix sessions
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
    recordMigration(db, 7);
  }

  // Migration 8: Library mappings and topics
  if (currentVersion < 8) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS library_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        npm_name TEXT NOT NULL UNIQUE,
        context7_id TEXT NOT NULL,
        context7_name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_library_mappings_npm ON library_mappings(npm_name);

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
    recordMigration(db, 8);
  }

  // Migration 9: Felix ADK integration tables
  if (currentVersion < 9) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ralph_adk_sessions (
        id TEXT PRIMARY KEY,
        app_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        state TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_ralph_adk_sessions_app_user ON ralph_adk_sessions(app_name, user_id);

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
    recordMigration(db, 9);
  }

  // Migration 10: Model router patterns
  if (currentVersion < 10) {
    db.exec(`
      ALTER TABLE felix_attempts ADD COLUMN signature_hash TEXT;
      ALTER TABLE felix_attempts ADD COLUMN escalated_from TEXT;

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
    recordMigration(db, 10);
  }

  // Migration 11: Rename ralph_* to felix_*
  if (currentVersion < 11) {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ralph_%'")
      .all() as Array<{ name: string }>;

    for (const { name } of tables) {
      const newName = name.replace('ralph_', 'felix_');
      try {
        db.prepare(`ALTER TABLE ${name} RENAME TO ${newName}`).run();
      } catch {
        // Table might already be renamed, continue
      }
    }
    recordMigration(db, 11);
  }

  // Migration 12: Add global memory types
  if (currentVersion < 12) {
    db.exec(`
      DROP TRIGGER IF EXISTS memories_ai;
      DROP TRIGGER IF EXISTS memories_ad;
      DROP TRIGGER IF EXISTS memories_au;
      DROP TABLE IF EXISTS memories_fts;

      CREATE TABLE IF NOT EXISTS memories_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('observation', 'decision', 'pattern', 'bugfix', 'feature', 'library', 'snippet', 'anti-pattern')),
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
        created_at_epoch INTEGER NOT NULL,
        scope TEXT DEFAULT 'project' CHECK(scope IN ('project', 'global')),
        source TEXT DEFAULT 'manual' CHECK(source IN ('manual', 'context7', 'ai-generated', 'promoted')),
        usage_count INTEGER DEFAULT 0,
        last_used_at TEXT,
        original_project TEXT,
        original_id INTEGER
      );

      INSERT INTO memories_new SELECT * FROM memories;
      DROP TABLE memories;
      ALTER TABLE memories_new RENAME TO memories;

      CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at_epoch DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_project_type ON memories(project, type);
      CREATE INDEX IF NOT EXISTS idx_memories_project_importance ON memories(project, importance);
      CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
      CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source);
      CREATE INDEX IF NOT EXISTS idx_memories_scope_type ON memories(scope, type);

      CREATE VIRTUAL TABLE memories_fts USING fts5(
        title,
        description,
        tags_text,
        features_text,
        tokenize='porter unicode61'
      );

      INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
      SELECT id, title, description,
             REPLACE(REPLACE(tags, '[', ''), ']', ''),
             REPLACE(REPLACE(features, '[', ''), ']', '')
      FROM memories;

      CREATE TRIGGER memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
        VALUES (new.id, new.title, new.description,
                REPLACE(REPLACE(new.tags, '[', ''), ']', ''),
                REPLACE(REPLACE(new.features, '[', ''), ']', ''));
      END;

      CREATE TRIGGER memories_ad AFTER DELETE ON memories BEGIN
        DELETE FROM memories_fts WHERE rowid = old.id;
      END;

      CREATE TRIGGER memories_au AFTER UPDATE ON memories BEGIN
        DELETE FROM memories_fts WHERE rowid = old.id;
        INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
        VALUES (new.id, new.title, new.description,
                REPLACE(REPLACE(new.tags, '[', ''), ']', ''),
                REPLACE(REPLACE(new.features, '[', ''), ']', ''));
      END;
    `);
    recordMigration(db, 12);
  }

  // Migration 13: Rebuild FTS index
  if (currentVersion < 13) {
    db.exec(`INSERT INTO memories_fts(memories_fts) VALUES('rebuild');`);
    recordMigration(db, 13);
  }

  // Migration 14: Legal consulting system
  if (currentVersion < 14) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS doc_embeddings (
        section_id INTEGER PRIMARY KEY REFERENCES doc_sections(id) ON DELETE CASCADE,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_doc_embeddings_model ON doc_embeddings(model);
    `);

    // Check if columns exist before adding
    const libDocsColumns = db.pragma('table_info(library_docs)') as Array<{ name: string }>;
    if (!libDocsColumns.some((col) => col.name === 'document_type')) {
      db.exec(`
        ALTER TABLE library_docs
          ADD COLUMN document_type TEXT
          CHECK(document_type IN ('legal', 'technical', 'general', 'personal'))
          DEFAULT 'technical';
      `);
    }
    if (!libDocsColumns.some((col) => col.name === 'jurisdiction')) {
      db.exec(`ALTER TABLE library_docs ADD COLUMN jurisdiction TEXT;`);
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS memories_v14 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN (
          'observation', 'decision', 'pattern', 'bugfix', 'feature',
          'library', 'snippet', 'anti-pattern', 'legal-case', 'personal-note'
        )),
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        importance TEXT NOT NULL DEFAULT 'medium' CHECK(importance IN ('low', 'medium', 'high', 'critical')),
        project TEXT NOT NULL,
        branch TEXT,
        commit_hash TEXT,
        tags TEXT DEFAULT '[]',
        files TEXT DEFAULT '[]',
        features TEXT DEFAULT '[]',
        scope TEXT CHECK(scope IN ('project', 'global')),
        source TEXT CHECK(source IN ('manual', 'context7', 'ai-generated', 'promoted')),
        usage_count INTEGER DEFAULT 0,
        last_used_at TEXT,
        original_project TEXT,
        original_id INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO memories_v14 (
        id, type, title, description, importance, project, branch, commit_hash,
        tags, files, features, scope, source, usage_count, last_used_at,
        original_project, original_id, created_at, updated_at
      )
      SELECT
        id, type, title, description, importance, project, branch, commit_hash,
        tags, files, features,
        COALESCE(scope, 'project'),
        COALESCE(source, 'manual'),
        usage_count, last_used_at,
        original_project, original_id, created_at,
        COALESCE(created_at, created_at) as updated_at
      FROM memories;

      DROP TABLE memories;
      ALTER TABLE memories_v14 RENAME TO memories;

      CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_usage ON memories(usage_count DESC);

      DROP TABLE IF EXISTS memories_fts;

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        title,
        description,
        tags_text,
        features_text,
        tokenize='porter unicode61'
      );

      INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
      SELECT id, title, description,
             REPLACE(REPLACE(tags, '[', ''), ']', ''),
             REPLACE(REPLACE(features, '[', ''), ']', '')
      FROM memories;

      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
        VALUES (new.id, new.title, new.description,
                REPLACE(REPLACE(new.tags, '[', ''), ']', ''),
                REPLACE(REPLACE(new.features, '[', ''), ']', ''));
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, title, description, tags_text, features_text)
        VALUES('delete', old.id, old.title, old.description, old.tags, old.features);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, title, description, tags_text, features_text)
        VALUES('delete', old.id, old.title, old.description, old.tags, old.features);
        INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
        VALUES (new.id, new.title, new.description,
                REPLACE(REPLACE(new.tags, '[', ''), ']', ''),
                REPLACE(REPLACE(new.features, '[', ''), ']', ''));
      END;
    `);
    recordMigration(db, 14);
  }

  // Migration 15: Fix missing columns from Migration 14
  if (currentVersion < 15) {
    const memoriesColumns = db.pragma('table_info(memories)') as Array<{ name: string }>;
    if (!memoriesColumns.some((col) => col.name === 'metadata')) {
      db.exec(`ALTER TABLE memories ADD COLUMN metadata TEXT DEFAULT '{}';`);
    }
    if (!memoriesColumns.some((col) => col.name === 'created_at_epoch')) {
      db.exec(`
        ALTER TABLE memories ADD COLUMN created_at_epoch INTEGER;
        UPDATE memories SET created_at_epoch = unixepoch(created_at) WHERE created_at_epoch IS NULL;
      `);
    }
    recordMigration(db, 15);
  }

  // Migration 16: Agent storage with hybrid search
  if (currentVersion < 16) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_agents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        plugin TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        model TEXT CHECK(model IN ('sonnet', 'opus', 'haiku', 'inherit')),
        keywords TEXT DEFAULT '[]',
        tech_stack TEXT DEFAULT '[]',
        project_types TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_agent_agents_category ON agent_agents(category);
      CREATE INDEX IF NOT EXISTS idx_agent_agents_plugin ON agent_agents(plugin);
      CREATE INDEX IF NOT EXISTS idx_agent_agents_hash ON agent_agents(content_hash);

      CREATE TABLE IF NOT EXISTS agent_embeddings (
        agent_id INTEGER PRIMARY KEY REFERENCES agent_agents(id) ON DELETE CASCADE,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS agent_agents_fts USING fts5(
        name,
        description,
        keywords_text,
        tech_stack_text,
        content='agent_agents',
        content_rowid='id',
        tokenize='porter unicode61'
      );

      CREATE TRIGGER IF NOT EXISTS agent_agents_ai AFTER INSERT ON agent_agents BEGIN
        INSERT INTO agent_agents_fts(rowid, name, description, keywords_text, tech_stack_text)
        VALUES (new.id, new.name, new.description,
                REPLACE(REPLACE(new.keywords, '[', ''), ']', ''),
                REPLACE(REPLACE(new.tech_stack, '[', ''), ']', ''));
      END;

      CREATE TRIGGER IF NOT EXISTS agent_agents_ad AFTER DELETE ON agent_agents BEGIN
        INSERT INTO agent_agents_fts(agent_agents_fts, rowid, name, description, keywords_text, tech_stack_text)
        VALUES('delete', old.id, old.name, old.description,
               REPLACE(REPLACE(old.keywords, '[', ''), ']', ''),
               REPLACE(REPLACE(old.tech_stack, '[', ''), ']', ''));
      END;

      CREATE TRIGGER IF NOT EXISTS agent_agents_au AFTER UPDATE ON agent_agents BEGIN
        INSERT INTO agent_agents_fts(agent_agents_fts, rowid, name, description, keywords_text, tech_stack_text)
        VALUES('delete', old.id, old.name, old.description,
               REPLACE(REPLACE(old.keywords, '[', ''), ']', ''),
               REPLACE(REPLACE(old.tech_stack, '[', ''), ']', ''));
        INSERT INTO agent_agents_fts(rowid, name, description, keywords_text, tech_stack_text)
        VALUES (new.id, new.name, new.description,
                REPLACE(REPLACE(new.keywords, '[', ''), ']', ''),
                REPLACE(REPLACE(new.tech_stack, '[', ''), ']', ''));
      END;

      CREATE TABLE IF NOT EXISTS agent_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id INTEGER NOT NULL REFERENCES agent_agents(id) ON DELETE CASCADE,
        project TEXT NOT NULL,
        feature TEXT,
        used_at TEXT NOT NULL DEFAULT (datetime('now')),
        success INTEGER DEFAULT 1,
        feedback TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_agent_usage_agent ON agent_usage(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_usage_project ON agent_usage(project);
      CREATE INDEX IF NOT EXISTS idx_agent_usage_used_at ON agent_usage(used_at DESC);
    `);
    recordMigration(db, 16);
  }

  // Migration 17: Add 'agent' memory type
  if (currentVersion < 17) {
    db.exec(`
      DROP TRIGGER IF EXISTS memories_ai;
      DROP TRIGGER IF EXISTS memories_ad;
      DROP TRIGGER IF EXISTS memories_au;
      DROP TABLE IF EXISTS memories_fts;

      CREATE TABLE IF NOT EXISTS memories_v17 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN (
          'observation', 'decision', 'pattern', 'bugfix', 'feature',
          'library', 'snippet', 'anti-pattern', 'legal-case', 'personal-note', 'agent'
        )),
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
        scope TEXT CHECK(scope IN ('project', 'global')),
        source TEXT CHECK(source IN ('manual', 'context7', 'ai-generated', 'promoted')),
        usage_count INTEGER DEFAULT 0,
        last_used_at TEXT,
        original_project TEXT,
        original_id INTEGER,
        created_at TEXT NOT NULL,
        created_at_epoch INTEGER,
        updated_at TEXT NOT NULL
      );

      INSERT INTO memories_v17 (
        id, type, title, description, importance, project, branch, commit_hash,
        tags, files, features, metadata, scope, source, usage_count, last_used_at,
        original_project, original_id, created_at, created_at_epoch, updated_at
      )
      SELECT
        id, type, title, description, importance, project, branch, commit_hash,
        tags, files, features,
        COALESCE(metadata, '{}'),
        COALESCE(scope, 'project'),
        COALESCE(source, 'manual'),
        usage_count, last_used_at,
        original_project, original_id, created_at, created_at_epoch,
        COALESCE(updated_at, created_at)
      FROM memories;

      DROP TABLE memories;
      ALTER TABLE memories_v17 RENAME TO memories;

      CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project);
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_usage ON memories(usage_count DESC);

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        title,
        description,
        tags_text,
        features_text,
        tokenize='porter unicode61'
      );

      INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
      SELECT id, title, description,
             REPLACE(REPLACE(tags, '[', ''), ']', ''),
             REPLACE(REPLACE(features, '[', ''), ']', '')
      FROM memories;

      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
        VALUES (new.id, new.title, new.description,
                REPLACE(REPLACE(new.tags, '[', ''), ']', ''),
                REPLACE(REPLACE(new.features, '[', ''), ']', ''));
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, title, description, tags_text, features_text)
        VALUES('delete', old.id, old.title, old.description, old.tags, old.features);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, title, description, tags_text, features_text)
        VALUES('delete', old.id, old.title, old.description, old.tags, old.features);
        INSERT INTO memories_fts(rowid, title, description, tags_text, features_text)
        VALUES (new.id, new.title, new.description,
                REPLACE(REPLACE(new.tags, '[', ''), ']', ''),
                REPLACE(REPLACE(new.features, '[', ''), ']', ''));
      END;
    `);
    recordMigration(db, 17);
  }

  // Migration 18: Agent unique_id = plugin:name (allow same name from different plugins)
  if (currentVersion < 18) {
    db.exec(`
      -- Drop old triggers
      DROP TRIGGER IF EXISTS agent_agents_ai;
      DROP TRIGGER IF EXISTS agent_agents_ad;
      DROP TRIGGER IF EXISTS agent_agents_au;

      -- Drop old FTS table
      DROP TABLE IF EXISTS agent_agents_fts;

      -- Create new table with unique_id instead of unique name
      CREATE TABLE IF NOT EXISTS agent_agents_v18 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unique_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT NOT NULL,
        plugin TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        model TEXT CHECK(model IN ('sonnet', 'opus', 'haiku', 'inherit')),
        keywords TEXT DEFAULT '[]',
        tech_stack TEXT DEFAULT '[]',
        project_types TEXT DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Migrate data with unique_id = plugin:name
      INSERT INTO agent_agents_v18 (
        unique_id, name, description, content, category, plugin, file_path,
        content_hash, model, keywords, tech_stack, project_types,
        created_at, updated_at, synced_at
      )
      SELECT
        plugin || ':' || name, name, description, content, category, plugin, file_path,
        content_hash, model, keywords, tech_stack, project_types,
        created_at, updated_at, synced_at
      FROM agent_agents;

      -- Drop old table and embeddings
      DROP TABLE IF EXISTS agent_embeddings;
      DROP TABLE IF EXISTS agent_agents;

      -- Rename new table
      ALTER TABLE agent_agents_v18 RENAME TO agent_agents;

      -- Recreate indexes
      CREATE INDEX IF NOT EXISTS idx_agent_agents_name ON agent_agents(name);
      CREATE INDEX IF NOT EXISTS idx_agent_agents_category ON agent_agents(category);
      CREATE INDEX IF NOT EXISTS idx_agent_agents_plugin ON agent_agents(plugin);
      CREATE INDEX IF NOT EXISTS idx_agent_agents_hash ON agent_agents(content_hash);

      -- Recreate embeddings table
      CREATE TABLE IF NOT EXISTS agent_embeddings (
        agent_id INTEGER PRIMARY KEY REFERENCES agent_agents(id) ON DELETE CASCADE,
        embedding BLOB NOT NULL,
        model TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Recreate FTS table
      CREATE VIRTUAL TABLE IF NOT EXISTS agent_agents_fts USING fts5(
        unique_id,
        name,
        description,
        keywords_text,
        tech_stack_text,
        content='agent_agents',
        content_rowid='id',
        tokenize='porter unicode61'
      );

      -- Populate FTS
      INSERT INTO agent_agents_fts(rowid, unique_id, name, description, keywords_text, tech_stack_text)
      SELECT id, unique_id, name, description,
             REPLACE(REPLACE(keywords, '[', ''), ']', ''),
             REPLACE(REPLACE(tech_stack, '[', ''), ']', '')
      FROM agent_agents;

      -- Recreate triggers
      CREATE TRIGGER IF NOT EXISTS agent_agents_ai AFTER INSERT ON agent_agents BEGIN
        INSERT INTO agent_agents_fts(rowid, unique_id, name, description, keywords_text, tech_stack_text)
        VALUES (new.id, new.unique_id, new.name, new.description,
                REPLACE(REPLACE(new.keywords, '[', ''), ']', ''),
                REPLACE(REPLACE(new.tech_stack, '[', ''), ']', ''));
      END;

      CREATE TRIGGER IF NOT EXISTS agent_agents_ad AFTER DELETE ON agent_agents BEGIN
        INSERT INTO agent_agents_fts(agent_agents_fts, rowid, unique_id, name, description, keywords_text, tech_stack_text)
        VALUES('delete', old.id, old.unique_id, old.name, old.description,
               REPLACE(REPLACE(old.keywords, '[', ''), ']', ''),
               REPLACE(REPLACE(old.tech_stack, '[', ''), ']', ''));
      END;

      CREATE TRIGGER IF NOT EXISTS agent_agents_au AFTER UPDATE ON agent_agents BEGIN
        INSERT INTO agent_agents_fts(agent_agents_fts, rowid, unique_id, name, description, keywords_text, tech_stack_text)
        VALUES('delete', old.id, old.unique_id, old.name, old.description,
               REPLACE(REPLACE(old.keywords, '[', ''), ']', ''),
               REPLACE(REPLACE(old.tech_stack, '[', ''), ']', ''));
        INSERT INTO agent_agents_fts(rowid, unique_id, name, description, keywords_text, tech_stack_text)
        VALUES (new.id, new.unique_id, new.name, new.description,
                REPLACE(REPLACE(new.keywords, '[', ''), ']', ''),
                REPLACE(REPLACE(new.tech_stack, '[', ''), ']', ''));
      END;
    `);
    recordMigration(db, 18);
  }

  // Migration 19: Plugin skills table (skills from plugins, tied to plugin name)
  if (currentVersion < 19) {
    db.exec(`
      -- Plugin skills table (SKILL.md files from plugins)
      CREATE TABLE IF NOT EXISTS plugin_skills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        unique_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        content TEXT NOT NULL,
        plugin TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        synced_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_plugin_skills_name ON plugin_skills(name);
      CREATE INDEX IF NOT EXISTS idx_plugin_skills_plugin ON plugin_skills(plugin);
      CREATE INDEX IF NOT EXISTS idx_plugin_skills_hash ON plugin_skills(content_hash);

      -- FTS for skill search
      CREATE VIRTUAL TABLE IF NOT EXISTS plugin_skills_fts USING fts5(
        unique_id,
        name,
        description,
        content='plugin_skills',
        content_rowid='id',
        tokenize='porter unicode61'
      );

      -- Triggers for FTS sync
      CREATE TRIGGER IF NOT EXISTS plugin_skills_ai AFTER INSERT ON plugin_skills BEGIN
        INSERT INTO plugin_skills_fts(rowid, unique_id, name, description)
        VALUES (new.id, new.unique_id, new.name, new.description);
      END;

      CREATE TRIGGER IF NOT EXISTS plugin_skills_ad AFTER DELETE ON plugin_skills BEGIN
        INSERT INTO plugin_skills_fts(plugin_skills_fts, rowid, unique_id, name, description)
        VALUES('delete', old.id, old.unique_id, old.name, old.description);
      END;

      CREATE TRIGGER IF NOT EXISTS plugin_skills_au AFTER UPDATE ON plugin_skills BEGIN
        INSERT INTO plugin_skills_fts(plugin_skills_fts, rowid, unique_id, name, description)
        VALUES('delete', old.id, old.unique_id, old.name, old.description);
        INSERT INTO plugin_skills_fts(rowid, unique_id, name, description)
        VALUES (new.id, new.unique_id, new.name, new.description);
      END;
    `);
    recordMigration(db, 19);
  }

  // Migration 20: Performance optimizations - partial indexes
  if (currentVersion < 20) {
    db.exec(`
      -- Partial index for critical memories (fast lookup for high-priority items)
      CREATE INDEX IF NOT EXISTS idx_memories_critical
        ON memories(created_at_epoch DESC)
        WHERE importance = 'critical';

      -- Partial index for high importance memories
      CREATE INDEX IF NOT EXISTS idx_memories_high_importance
        ON memories(project, created_at_epoch DESC)
        WHERE importance IN ('critical', 'high');

      -- Composite index for memory link traversal
      CREATE INDEX IF NOT EXISTS idx_memory_links_traverse
        ON memory_links(from_id, link_type);

      -- Composite index for agent search by category + plugin
      CREATE INDEX IF NOT EXISTS idx_agent_agents_category_plugin
        ON agent_agents(category, plugin);

      -- Composite index for doc sections lookup
      CREATE INDEX IF NOT EXISTS idx_doc_sections_library_topic
        ON doc_sections(library_id, topic);
    `);
    recordMigration(db, 20);
  }

  // Migration 21: sqlite-vec vector tables for ANN search
  // Uses vec0 virtual tables for O(log n) k-NN search instead of O(n) full scan
  // MiniLM-L6-v2 produces 384-dimensional float vectors
  if (currentVersion < 21) {
    try {
      // Check if sqlite-vec is available
      const vecVersion = db.prepare('SELECT vec_version() as v').get() as { v: string } | undefined;
      if (vecVersion) {
        db.exec(`
          -- Vector table for memory embeddings (384-dim for MiniLM-L6-v2)
          CREATE VIRTUAL TABLE IF NOT EXISTS memory_vec USING vec0(
            embedding float[384]
          );

          -- Vector table for agent embeddings
          CREATE VIRTUAL TABLE IF NOT EXISTS agent_vec USING vec0(
            embedding float[384]
          );

          -- Vector table for doc section embeddings
          CREATE VIRTUAL TABLE IF NOT EXISTS doc_vec USING vec0(
            embedding float[384]
          );

          -- Mapping table to link vec rowid to memory id (vec0 uses integer rowids)
          CREATE TABLE IF NOT EXISTS memory_vec_map (
            vec_rowid INTEGER PRIMARY KEY,
            memory_id INTEGER NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
          );

          -- Mapping table for agents
          CREATE TABLE IF NOT EXISTS agent_vec_map (
            vec_rowid INTEGER PRIMARY KEY,
            agent_id INTEGER NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (agent_id) REFERENCES agent_agents(id) ON DELETE CASCADE
          );

          -- Mapping table for doc sections
          CREATE TABLE IF NOT EXISTS doc_vec_map (
            vec_rowid INTEGER PRIMARY KEY,
            section_id INTEGER NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (section_id) REFERENCES doc_sections(id) ON DELETE CASCADE
          );

          -- Indexes for fast lookup
          CREATE INDEX IF NOT EXISTS idx_memory_vec_map_memory ON memory_vec_map(memory_id);
          CREATE INDEX IF NOT EXISTS idx_agent_vec_map_agent ON agent_vec_map(agent_id);
          CREATE INDEX IF NOT EXISTS idx_doc_vec_map_section ON doc_vec_map(section_id);
        `);
        recordMigration(db, 21);
      } else {
        // sqlite-vec not available, skip this migration
        // Will use fallback BLOB-based search
        recordMigration(db, 21);
      }
    } catch {
      // sqlite-vec extension not loaded, record migration anyway to avoid retries
      recordMigration(db, 21);
    }
  }
}

// ============================================================================
// ROLLBACK SUPPORT
// ============================================================================

/**
 * Down migrations for rollback support
 * Only recent migrations have down functions - older migrations are considered stable
 */
const DOWN_MIGRATIONS: Record<number, (db: Database) => void> = {
  21: (db) => {
    // Migration 21: Remove sqlite-vec tables
    db.exec(`
      DROP TABLE IF EXISTS doc_vec_map;
      DROP TABLE IF EXISTS agent_vec_map;
      DROP TABLE IF EXISTS memory_vec_map;
      DROP TABLE IF EXISTS doc_vec;
      DROP TABLE IF EXISTS agent_vec;
      DROP TABLE IF EXISTS memory_vec;
    `);
  },
  20: (db) => {
    // Migration 20: Remove performance indexes
    db.exec(`
      DROP INDEX IF EXISTS idx_memories_critical;
      DROP INDEX IF EXISTS idx_memories_high_importance;
      DROP INDEX IF EXISTS idx_memory_links_traverse;
      DROP INDEX IF EXISTS idx_agent_agents_category_plugin;
      DROP INDEX IF EXISTS idx_doc_sections_library_topic;
    `);
  },
  19: (db) => {
    // Migration 19: Remove plugin_skills table
    db.exec(`
      DROP TRIGGER IF EXISTS plugin_skills_ai;
      DROP TRIGGER IF EXISTS plugin_skills_ad;
      DROP TRIGGER IF EXISTS plugin_skills_au;
      DROP TABLE IF EXISTS plugin_skills_fts;
      DROP TABLE IF EXISTS plugin_skills;
    `);
  },
  18: (_db) => {
    // Migration 18: Cannot easily rollback unique_id change
    // This would require data migration, so we just log a warning
    throw new Error(
      'Migration 18 (agent unique_id) cannot be rolled back - requires manual intervention',
    );
  },
};

/**
 * Remove migration record from schema_versions
 */
function removeMigrationRecord(db: Database, version: number): void {
  const sql = 'DELETE FROM schema_versions WHERE version = ?';
  prepareStatement<[number]>(db, sql).run(version);
}

/**
 * Rollback database to a specific version
 *
 * @param db - Database instance
 * @param targetVersion - Version to rollback to (must be lower than current)
 * @throws Error if rollback is not possible
 *
 * @example
 * ```typescript
 * // Rollback from v20 to v19
 * rollbackMigration(db, 19);
 * ```
 */
export function rollbackMigration(db: Database, targetVersion: number): void {
  const currentVersion = getSchemaVersion(db);

  if (targetVersion >= currentVersion) {
    throw new Error(
      `Target version ${targetVersion} must be lower than current version ${currentVersion}`,
    );
  }

  if (targetVersion < 17) {
    throw new Error('Cannot rollback below version 17 - only recent migrations support rollback');
  }

  // Rollback each version in reverse order
  for (let version = currentVersion; version > targetVersion; version--) {
    const downFn = DOWN_MIGRATIONS[version];

    if (!downFn) {
      throw new Error(`No rollback function available for migration ${version}`);
    }

    try {
      downFn(db);
      removeMigrationRecord(db, version);
    } catch (error) {
      throw new Error(`Failed to rollback migration ${version}: ${error}`);
    }
  }
}
