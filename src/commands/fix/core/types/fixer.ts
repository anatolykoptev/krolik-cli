/**
 * @module commands/fix/core/types/fixer
 * @description Fixer-specific types for the registry and runner
 */

import type { QualityIssue } from './analysis';
import type { QualityCategory } from './categories';
import type { FixDifficulty, FixOperation } from './fix';

/**
 * Fixer metadata - describes a fixer
 */
export interface FixerMetadata {
  /** Unique fixer identifier (e.g., "console", "debugger", "any-type") */
  id: string;
  /** Human-readable name (e.g., "Console Statements") */
  name: string;
  /** Description for help text */
  description: string;
  /** Category this fixer handles */
  category: QualityCategory;
  /** Default difficulty level */
  difficulty: FixDifficulty;
  /** CLI flag name (e.g., "--fix-console") */
  cliFlag: string;
  /** Optional negation flag (e.g., "--no-console") */
  negateFlag?: string | undefined;
  /** Tags for grouping (e.g., ["trivial", "safe-to-autofix"]) */
  tags?: string[] | undefined;
}

/**
 * Context passed to fixer lifecycle hooks
 */
export interface FixerContext {
  /** Project root directory */
  projectRoot: string;
  /** Whether this is a dry run (preview only) */
  dryRun: boolean;
  /** Total number of issues being fixed */
  totalIssues: number;
}

/**
 * Fixer interface - self-contained unit for detecting and fixing issues
 */
export interface Fixer {
  /** Metadata about this fixer */
  metadata: FixerMetadata;

  /**
   * Analyze content and return issues this fixer can handle
   * @param content - File content
   * @param file - File path
   * @returns Array of quality issues
   */
  analyze(content: string, file: string): QualityIssue[];

  /**
   * Generate fix operation for an issue
   * @param issue - The issue to fix
   * @param content - Current file content
   * @returns Fix operation or null if can't fix
   */
  fix(issue: QualityIssue, content: string): Promise<FixOperation | null> | FixOperation | null;

  /**
   * Optional: check if this issue should be skipped (e.g., in test files)
   * @param issue - The issue to check
   * @param content - File content
   * @returns true to skip, false to process
   */
  shouldSkip?(issue: QualityIssue, content: string): boolean;

  /**
   * Optional: called before any fixes are applied
   * Use for loading resources, initializing state, etc.
   * @param context - Fixer context with project info
   */
  onStart?(context: FixerContext): Promise<void> | void;

  /**
   * Optional: called after all fixes are applied
   * Use for flushing resources, cleanup, writing files, etc.
   * @param context - Fixer context with project info
   */
  onComplete?(context: FixerContext): Promise<void> | void;
}
