/**
 * @module lib/@storage/ralph/database
 * @description Shared database utilities for Ralph Loop operations
 */

import type Database from 'better-sqlite3';
import { getDatabase, getProjectDatabase } from '../database';

/**
 * Get database for Ralph operations
 * Uses project-level storage when projectPath is provided
 */
export function getRalphDatabase(projectPath?: string): Database.Database {
  if (projectPath) {
    return getProjectDatabase(projectPath);
  }
  // Fallback to global DB for backward compatibility
  return getDatabase();
}
