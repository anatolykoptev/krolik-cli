/**
 * @module lib/@storage/felix/database
 * @description Shared database utilities for Krolik Felix operations
 */

import type Database from 'better-sqlite3';
import { getDatabase, getProjectDatabase } from '../database';

/**
 * Get database for Felix operations
 * Uses project-level storage when projectPath is provided
 */
export function getFelixDatabase(projectPath?: string): Database.Database {
  if (projectPath) {
    return getProjectDatabase(projectPath);
  }
  // Fallback to global DB for backward compatibility
  return getDatabase();
}
