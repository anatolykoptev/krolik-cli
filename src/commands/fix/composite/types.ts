/**
 * @module commands/fix/composite/types
 * @description Types for composite (atomic) multi-operation transforms
 *
 * Composite transforms allow multiple AST operations to be executed
 * as a single atomic unit - all succeed or all rollback.
 */

import type { FixOperation } from '../types';

// ============================================================================
// COMPOSITE OPERATION
// ============================================================================

/**
 * Supported composite operation types
 */
export type CompositeOperationType =
  | 'rename' // Rename identifier across files
  | 'move' // Move file/function to new location
  | 'extract' // Extract code into new file/function
  | 'inline' // Inline code from imported module
  | 'update-exports' // Update barrel exports
  | 'update-imports' // Update import paths
  | 'delete' // Delete file/export
  | 'custom'; // Custom operation with fix operations

/**
 * Single operation within a composite transform
 */
export interface CompositeStep {
  /** Operation type */
  type: CompositeOperationType;
  /** Human-readable description */
  description: string;
  /** Target files affected */
  files: string[];
  /** Operation-specific config */
  config: RenameConfig | MoveConfig | ExtractConfig | CustomConfig;
  /** Low-level fix operations (generated) */
  operations?: FixOperation[];
}

/**
 * Rename operation config
 */
export interface RenameConfig {
  type: 'rename';
  /** Old identifier name */
  from: string;
  /** New identifier name */
  to: string;
  /** Scope: 'file' | 'project' */
  scope?: 'file' | 'project';
}

/**
 * Move operation config
 */
export interface MoveConfig {
  type: 'move';
  /** Source path */
  from: string;
  /** Destination path */
  to: string;
  /** Update all imports referencing this file */
  updateImports?: boolean;
}

/**
 * Extract operation config
 */
export interface ExtractConfig {
  type: 'extract';
  /** Source file */
  sourceFile: string;
  /** Target file to create */
  targetFile: string;
  /** Items to extract (function/type names) */
  items: string[];
  /** Create re-export in source file */
  reexport?: boolean;
}

/**
 * Custom operation config (uses low-level FixOperations)
 */
export interface CustomConfig {
  type: 'custom';
  /** Low-level operations to apply */
  operations: FixOperation[];
}

// ============================================================================
// COMPOSITE TRANSFORM
// ============================================================================

/**
 * A composite transform - multiple operations as one atomic unit
 */
export interface CompositeTransform {
  /** Unique ID for this transform */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** Steps to execute (in order) */
  steps: CompositeStep[];
  /** All files that will be modified */
  affectedFiles: string[];
  /** Verification config */
  verification?: VerificationConfig;
}

/**
 * Verification to run after composite transform
 */
export interface VerificationConfig {
  /** Run TypeScript type check */
  typecheck?: boolean;
  /** Run Biome lint */
  lint?: boolean;
  /** Run tests (pattern or boolean) */
  tests?: boolean | string;
  /** Custom verification command */
  customCommand?: string;
}

// ============================================================================
// TRANSACTION
// ============================================================================

/**
 * Transaction state
 */
export type TransactionState =
  | 'pending' // Not started
  | 'in_progress' // Executing steps
  | 'committed' // All steps succeeded
  | 'rolled_back' // Rolled back due to failure
  | 'failed'; // Failed with no rollback possible

/**
 * File backup for rollback
 */
export interface FileBackup {
  /** File path */
  path: string;
  /** Original content (null if file didn't exist) */
  content: string | null;
  /** Whether file was created by this transaction */
  isNew: boolean;
}

/**
 * Transaction - manages atomic execution of composite transform
 */
export interface Transaction {
  /** Transaction ID */
  id: string;
  /** Composite transform being executed */
  transform: CompositeTransform;
  /** Current state */
  state: TransactionState;
  /** File backups for rollback */
  backups: FileBackup[];
  /** Steps completed */
  completedSteps: number;
  /** Error if failed */
  error?: string;
  /** Started at */
  startedAt: Date;
  /** Completed at */
  completedAt?: Date;
}

// ============================================================================
// EXECUTION RESULT
// ============================================================================

/**
 * Result of executing a composite step
 */
export interface StepResult {
  /** Step index */
  index: number;
  /** Step that was executed */
  step: CompositeStep;
  /** Success */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Files modified */
  filesModified: string[];
}

/**
 * Result of executing a composite transform
 */
export interface CompositeResult {
  /** Transform that was executed */
  transform: CompositeTransform;
  /** Transaction used */
  transaction: Transaction;
  /** Success */
  success: boolean;
  /** Step results */
  steps: StepResult[];
  /** Verification result */
  verification?: VerificationResult;
  /** Duration in ms */
  duration: number;
}

/**
 * Verification result
 */
export interface VerificationResult {
  /** Overall success */
  success: boolean;
  /** TypeScript check result */
  typecheck?: { success: boolean; errors?: number };
  /** Lint result */
  lint?: { success: boolean; errors?: number };
  /** Test result */
  tests?: { success: boolean; passed?: number; failed?: number };
}
