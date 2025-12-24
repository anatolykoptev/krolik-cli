/**
 * @module commands/refactor/core/types-migration
 * @description Types for type/interface duplicate migration
 *
 * Extends the migration system to support merging duplicate types.
 */

import type { RiskLevel } from './types';

// ============================================================================
// TYPE MIGRATION ACTIONS
// ============================================================================

/**
 * Type migration action types
 */
export type TypeMigrationActionType =
  | 'remove-type' // Remove type from source file
  | 'add-import' // Add import to file that used local type
  | 'update-import'; // Update import path in dependent file

/**
 * Type migration action
 */
export interface TypeMigrationAction {
  /** Action type */
  type: TypeMigrationActionType;
  /** Type/interface name being migrated */
  typeName: string;
  /** Source file (where type will be removed) */
  sourceFile: string;
  /** Target file (canonical location where type remains) */
  targetFile: string;
  /** Risk level */
  risk: RiskLevel;
  /** Similarity score (for reporting) */
  similarity: number;
  /** Whether JSDoc should be preserved from source */
  preserveJSDoc?: boolean;
  /** Original name if different from canonical */
  originalName?: string;
}

/**
 * Import update action for dependent files
 */
export interface ImportUpdateAction {
  /** File that needs import update */
  file: string;
  /** Type name being imported */
  typeName: string;
  /** Old import source */
  oldSource: string;
  /** New import source */
  newSource: string;
}

// ============================================================================
// TYPE MIGRATION PLAN
// ============================================================================

/**
 * Type migration plan
 */
export interface TypeMigrationPlan {
  /** Type removal actions */
  actions: TypeMigrationAction[];
  /** Import update actions */
  importUpdates: ImportUpdateAction[];
  /** Statistics */
  stats: {
    /** Number of types to remove */
    typesToRemove: number;
    /** Number of imports to update */
    importsToUpdate: number;
    /** Number of files affected */
    filesAffected: number;
  };
  /** Risk breakdown */
  riskSummary: {
    safe: number;
    medium: number;
    risky: number;
  };
}

// ============================================================================
// CANONICAL SELECTION
// ============================================================================

/**
 * Type location with usage info for canonical selection
 */
export interface TypeLocationInfo {
  /** File path */
  file: string;
  /** Type name in this file */
  name: string;
  /** Line number */
  line: number;
  /** Whether exported */
  exported: boolean;
  /** Number of files that import this type from here */
  importerCount: number;
  /** Whether file is a dedicated types file */
  isTypeFile: boolean;
  /** Whether has JSDoc */
  hasJSDoc: boolean;
  /** Path depth (shorter = better) */
  pathDepth: number;
}

/**
 * Criteria for selecting canonical location
 */
export interface CanonicalSelectionCriteria {
  /** Prefer exported types over non-exported */
  preferExported: boolean;
  /** Prefer dedicated type files (types.ts, core/types.ts) */
  preferTypeFiles: boolean;
  /** Prefer files with more importers */
  preferMostUsed: boolean;
  /** Prefer files with JSDoc */
  preferWithJSDoc: boolean;
  /** Prefer shorter import paths */
  preferShorterPath: boolean;
}

/**
 * Default canonical selection criteria
 */
export const DEFAULT_CANONICAL_CRITERIA: CanonicalSelectionCriteria = {
  preferExported: true,
  preferTypeFiles: true,
  preferMostUsed: true,
  preferWithJSDoc: true,
  preferShorterPath: true,
};

// ============================================================================
// EXECUTION RESULTS
// ============================================================================

/**
 * Result of a single type migration action
 */
export interface TypeMigrationResult {
  /** Whether action succeeded */
  success: boolean;
  /** Action that was executed */
  action: TypeMigrationAction | ImportUpdateAction;
  /** Result message */
  message: string;
  /** Error if failed */
  error?: string;
  /** Files modified */
  modifiedFiles?: string[];
}

/**
 * Result of executing full migration plan
 */
export interface TypeMigrationExecutionResult {
  /** Whether all actions succeeded */
  success: boolean;
  /** Individual results */
  results: TypeMigrationResult[];
  /** Summary */
  summary: {
    succeeded: number;
    failed: number;
    skipped: number;
  };
  /** Backup branch name if created */
  backupBranch?: string;
}

// ============================================================================
// OPTIONS
// ============================================================================

/**
 * Options for type migration planning
 */
export interface TypeMigrationPlanOptions {
  /** Only process 100% identical types (default: true) */
  onlyIdentical?: boolean;
  /** Minimum similarity threshold (default: 1.0) */
  minSimilarity?: number;
  /** Custom canonical selection criteria */
  canonicalCriteria?: Partial<CanonicalSelectionCriteria>;
}

/**
 * Options for type migration execution
 */
export interface TypeMigrationExecutionOptions {
  /** Dry run - don't modify files */
  dryRun?: boolean;
  /** Create git backup before execution */
  backup?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Stop on first error */
  stopOnError?: boolean;
}
