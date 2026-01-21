/**
 * @module lib/@storage/database/connection
 * @description Database connection management
 *
 * Supports hybrid memory architecture:
 * - Global database (~/.krolik/memory/memories.db): patterns, library docs, snippets, agents
 * - Project database ({project}/.krolik/memory/krolik.db): decisions, bugs, features
 */

import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';

import { ensureDir } from '../../@core/fs';
import { logger } from '../../@core/logger';
import { CURRENT_VERSION, getSchemaVersion, runMigrations } from './migrations';
import { clearStatementCache } from './statements';
import type { DatabaseOptions } from './types';

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
export function getEffectiveDbPath(options?: DatabaseOptions): string {
  if (options?.scope === 'project' && options.projectPath) {
    return getProjectDbPath(options.projectPath);
  }
  // Default to global DB
  return getLegacyGlobalDbPath();
}

// ============================================================================
// BACKUP
// ============================================================================

/** Maximum number of backup files to keep per database */
const MAX_BACKUPS = 3;

/**
 * Create backup of database before migrations
 * Keeps only the last MAX_BACKUPS files
 *
 * @param dbPath - Path to the database file
 * @param currentVersion - Current schema version
 * @returns Backup path or null if not needed
 */
function backupBeforeMigration(dbPath: string, currentVersion: number): string | null {
  // Only backup if migrations are needed
  if (currentVersion >= CURRENT_VERSION) {
    return null;
  }

  // Check if database file exists
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  try {
    const backupDir = path.join(path.dirname(dbPath), 'backups');
    ensureDir(backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${path.basename(dbPath, '.db')}-v${currentVersion}-${timestamp}.db`;
    const backupPath = path.join(backupDir, backupName);

    // Copy database file
    fs.copyFileSync(dbPath, backupPath);

    // Also copy WAL and SHM files if they exist
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) {
      fs.copyFileSync(walPath, `${backupPath}-wal`);
    }
    if (fs.existsSync(shmPath)) {
      fs.copyFileSync(shmPath, `${backupPath}-shm`);
    }

    logger.info(`Database backup created: ${backupPath}`);

    // Cleanup old backups (keep only MAX_BACKUPS)
    cleanupOldBackups(backupDir, path.basename(dbPath, '.db'));

    return backupPath;
  } catch (error) {
    logger.warn(`Failed to create database backup: ${error}`);
    return null;
  }
}

/**
 * Remove old backup files, keeping only the most recent MAX_BACKUPS
 */
function cleanupOldBackups(backupDir: string, dbBaseName: string): void {
  try {
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith(dbBaseName) && f.endsWith('.db'))
      .map((f) => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime); // Newest first

    // Remove old backups
    for (const file of files.slice(MAX_BACKUPS)) {
      fs.unlinkSync(file.path);
      // Also remove WAL/SHM if exist
      const walPath = `${file.path}-wal`;
      const shmPath = `${file.path}-shm`;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);
      logger.debug(`Removed old backup: ${file.name}`);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// DATABASE INSTANCE CACHE
// ============================================================================

/** Database instances cache (keyed by path) */
const dbInstances = new Map<string, Database.Database>();

/**
 * Get or create database instance
 *
 * Creates a new database if it doesn't exist, runs migrations,
 * and caches the instance for future use.
 *
 * @param options - Database options (scope and projectPath)
 * @returns Database instance
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

  // Load sqlite-vec extension for vector search
  try {
    sqliteVec.load(db);
    logger.debug('sqlite-vec extension loaded successfully');
  } catch (error) {
    logger.warn(`Failed to load sqlite-vec extension: ${error}`);
    // Continue without vector search - fallback to BLOB-based search
  }

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  // Backup before migrations (only if needed)
  const currentVersion = getSchemaVersion(db);
  backupBeforeMigration(dbPath, currentVersion);

  // Run migrations
  runMigrations(db);

  // Clear statement cache after migrations (schema may have changed)
  clearStatementCache();

  // Cache instance
  dbInstances.set(dbPath, db);

  return db;
}

/**
 * Get global database instance
 * Convenience method for global memory operations (patterns, library docs, agents)
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
      clearStatementCache(dbPath);
    }
  } else {
    // Close all databases
    clearStatementCache();
    for (const [, db] of dbInstances) {
      db.close();
    }
    dbInstances.clear();
  }
}

/**
 * Close all database connections
 */
export function closeAllDatabases(): void {
  closeDatabase();
}

/**
 * Check if database exists at path
 */
export function databaseExists(options?: DatabaseOptions): boolean {
  const dbPath = getEffectiveDbPath(options);
  return dbInstances.has(dbPath);
}

/**
 * Get all open database paths
 */
export function getOpenDatabasePaths(): string[] {
  return Array.from(dbInstances.keys());
}
