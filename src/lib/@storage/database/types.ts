/**
 * @module lib/@storage/database/types
 * @description Database types and interfaces
 */

import type { Database } from 'better-sqlite3';

/**
 * Database scope determines where the database file is stored
 */
export type DatabaseScope = 'global' | 'project';

/**
 * Options for database operations
 */
export interface DatabaseOptions {
  /** Database scope: 'global' for ~/.krolik, 'project' for {projectPath}/.krolik */
  scope?: DatabaseScope;
  /** Required for 'project' scope - absolute path to project root */
  projectPath?: string;
}

/**
 * Database statistics
 */
export interface DatabaseStats {
  path: string;
  sizeBytes: number;
  tables: number;
  schemaVersion: number;
}

/**
 * Migration function signature
 */
export type MigrationFn = (db: Database) => void;

/**
 * Migration definition
 */
export interface Migration {
  /** Migration version number (1-based) */
  version: number;
  /** Short description of what this migration does */
  description: string;
  /** Migration function that modifies the database schema */
  up: MigrationFn;
  /** Optional rollback function to undo the migration */
  down?: MigrationFn;
}
