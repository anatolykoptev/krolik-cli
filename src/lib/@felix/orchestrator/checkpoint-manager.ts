/**
 * CheckpointManager - Crash recovery with SQLite checkpoints
 *
 * Uses the central krolik.db database via @storage/database
 * Table: ralph_checkpoints (created in migration 9)
 *
 * @module @felix/orchestrator/checkpoint-manager
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { normalize, resolve as resolvePath } from 'node:path';
import type Database from 'better-sqlite3';
import { getProjectDatabase } from '../../@storage/database.js';
import type { RalphLoopState, TaskExecutionResult } from '../types.js';
import type { FelixOrchestratorConfig } from './types.js';

/**
 * Security: Validate file path to prevent path traversal (CWE-22)
 * @param filePath - Path to validate
 * @param allowedRoot - Optional root directory to restrict access
 * @throws Error if path is invalid or contains traversal attempt
 */
function validateFilePath(filePath: string, allowedRoot?: string): string {
  // Normalize and resolve to absolute path
  const normalized = normalize(filePath);
  const resolved = resolvePath(normalized);

  // Check for path traversal patterns in original input
  if (filePath.includes('..')) {
    throw new Error(`Security: File path contains path traversal attempt: "${filePath}"`);
  }

  // If allowed root specified, ensure resolved path is within it
  if (allowedRoot) {
    const resolvedRoot = realpathSync(resolvePath(allowedRoot));
    const resolvedFile = realpathSync(resolved);
    if (!resolvedFile.startsWith(resolvedRoot)) {
      throw new Error(
        `Security: File path "${resolved}" is outside allowed root "${resolvedRoot}"`,
      );
    }
  }

  // Verify file exists and is a regular file
  if (!existsSync(resolved)) {
    throw new Error(`File does not exist: "${resolved}"`);
  }

  const stat = statSync(resolved);
  if (!stat.isFile()) {
    throw new Error(`Path is not a regular file: "${resolved}"`);
  }

  return resolved;
}

/**
 * Checkpoint data structure
 */
export interface Checkpoint {
  id: string;
  sessionId: string;
  prdPath: string;
  prdHash: string;
  state: RalphLoopState;
  taskResults: TaskExecutionResult[];
  config: Partial<FelixOrchestratorConfig>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Database row structure
 */
interface CheckpointRow {
  id: string;
  session_id: string;
  prd_path: string;
  prd_hash: string;
  state: string;
  task_results: string;
  config: string;
  created_at: string;
  updated_at: string;
}

/**
 * Serializable config subset (excluding functions)
 */
type SerializableConfig = Omit<
  Partial<FelixOrchestratorConfig>,
  'onEvent' | 'onCostUpdate' | 'plugins' | 'onCircuitBreakerTrip'
>;

/**
 * CheckpointManager - Manages crash recovery checkpoints using central krolik.db
 *
 * Table used (from migration 9): ralph_checkpoints
 */
export class CheckpointManager {
  private db: Database.Database;

  /**
   * Create checkpoint manager with existing database connection
   * @param db - Database instance from getProjectDatabase()
   */
  constructor(db: Database.Database) {
    this.db = db;
  }

  /**
   * Save checkpoint after each task completion
   */
  saveCheckpoint(checkpoint: Checkpoint): void {
    const serializableConfig = this.extractSerializableConfig(checkpoint.config);

    this.db
      .prepare(
        `INSERT INTO ralph_checkpoints (id, session_id, prd_path, prd_hash, state, task_results, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           state = excluded.state,
           task_results = excluded.task_results,
           config = excluded.config,
           updated_at = excluded.updated_at`,
      )
      .run(
        checkpoint.id,
        checkpoint.sessionId,
        checkpoint.prdPath,
        checkpoint.prdHash,
        JSON.stringify(checkpoint.state),
        JSON.stringify(checkpoint.taskResults),
        JSON.stringify(serializableConfig),
        checkpoint.createdAt,
        checkpoint.updatedAt,
      );
  }

  /**
   * Load latest checkpoint for a PRD
   */
  loadCheckpoint(prdPath: string): Checkpoint | null {
    const row = this.db
      .prepare(
        `SELECT * FROM ralph_checkpoints
         WHERE prd_path = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(prdPath) as CheckpointRow | undefined;

    if (!row) return null;

    return this.rowToCheckpoint(row);
  }

  /**
   * Load checkpoint by session ID
   */
  loadCheckpointBySession(sessionId: string): Checkpoint | null {
    const row = this.db
      .prepare(
        `SELECT * FROM ralph_checkpoints
         WHERE session_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`,
      )
      .get(sessionId) as CheckpointRow | undefined;

    if (!row) return null;

    return this.rowToCheckpoint(row);
  }

  /**
   * Check if checkpoint is valid (PRD hasn't changed)
   */
  isCheckpointValid(checkpoint: Checkpoint, currentPrdHash: string): boolean {
    return checkpoint.prdHash === currentPrdHash;
  }

  /**
   * Clear checkpoint after successful completion
   */
  clearCheckpoint(sessionId: string): void {
    this.db.prepare(`DELETE FROM ralph_checkpoints WHERE session_id = ?`).run(sessionId);
  }

  /**
   * Clear checkpoint by PRD path
   */
  clearCheckpointByPrd(prdPath: string): void {
    this.db.prepare(`DELETE FROM ralph_checkpoints WHERE prd_path = ?`).run(prdPath);
  }

  /**
   * List all checkpoints
   */
  listCheckpoints(): Checkpoint[] {
    const rows = this.db
      .prepare(`SELECT * FROM ralph_checkpoints ORDER BY updated_at DESC`)
      .all() as CheckpointRow[];

    return rows.map((row) => this.rowToCheckpoint(row));
  }

  /**
   * Calculate MD5 hash of PRD content
   * @param prdPath - Path to PRD file
   * @param allowedRoot - Optional root directory to restrict file access (CWE-22 prevention)
   * @throws Error if path is invalid or contains traversal attempt
   */
  static calculatePrdHash(prdPath: string, allowedRoot?: string): string {
    // Security: Validate path to prevent path traversal (CWE-22)
    const validatedPath = validateFilePath(prdPath, allowedRoot);
    const content = readFileSync(validatedPath, 'utf-8');
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Generate checkpoint ID from session ID
   */
  static generateCheckpointId(sessionId: string): string {
    return `checkpoint-${sessionId}`;
  }

  /**
   * Convert database row to Checkpoint object
   */
  private rowToCheckpoint(row: CheckpointRow): Checkpoint {
    return {
      id: row.id,
      sessionId: row.session_id,
      prdPath: row.prd_path,
      prdHash: row.prd_hash,
      state: JSON.parse(row.state) as RalphLoopState,
      taskResults: JSON.parse(row.task_results) as TaskExecutionResult[],
      config: JSON.parse(row.config) as Partial<FelixOrchestratorConfig>,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Extract serializable config (remove functions and non-serializable values)
   */
  private extractSerializableConfig(config: Partial<FelixOrchestratorConfig>): SerializableConfig {
    const {
      onEvent: _onEvent,
      onCostUpdate: _onCostUpdate,
      plugins: _plugins,
      onCircuitBreakerTrip: _onCircuitBreakerTrip,
      ...serializableConfig
    } = config;
    return serializableConfig;
  }

  /**
   * Clean up old checkpoints (older than specified days)
   * @param maxAgeDays - Maximum age in days (must be positive integer, max 3650)
   * @throws Error if maxAgeDays is invalid (CWE-89 prevention)
   */
  cleanupOldCheckpoints(maxAgeDays: number): number {
    // Security: Validate maxAgeDays to prevent SQL injection (CWE-89)
    const MAX_AGE_DAYS_LIMIT = 365 * 10; // 10 years max
    if (!Number.isInteger(maxAgeDays) || maxAgeDays <= 0 || maxAgeDays > MAX_AGE_DAYS_LIMIT) {
      throw new Error(
        `Security: maxAgeDays must be a positive integer between 1 and ${MAX_AGE_DAYS_LIMIT}, got: ${maxAgeDays}`,
      );
    }

    const result = this.db
      .prepare(
        `DELETE FROM ralph_checkpoints
         WHERE updated_at < datetime('now', '-' || ? || ' days')`,
      )
      .run(maxAgeDays);

    return result.changes;
  }
}

/**
 * Create a CheckpointManager using the central krolik.db
 *
 * @param projectRoot - Absolute path to project root
 */
export function createCheckpointManager(projectRoot: string): CheckpointManager {
  const db = getProjectDatabase(projectRoot);
  return new CheckpointManager(db);
}
