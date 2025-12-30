/**
 * @module commands/fix/core/types/fix
 * @description Types for fix operations and strategies
 */

import type { QualityIssue } from './analysis';
import type { QualityCategory } from './categories';

/**
 * Fix action types
 */
export type FixAction =
  | 'delete-line'
  | 'replace-line'
  | 'replace-range'
  | 'insert-before'
  | 'insert-after'
  | 'wrap-function'
  | 'extract-function'
  | 'split-file'
  | 'move-file' // For refine: move to @namespace
  | 'create-barrel'; // For refine: create index.ts

/**
 * A single fix operation
 */
export interface FixOperation {
  action: FixAction;
  file: string;
  line?: number | undefined;
  endLine?: number | undefined;
  oldCode?: string | undefined;
  newCode?: string | undefined;
  /** For extract-function: name of new function */
  functionName?: string | undefined;
  /** For split-file: new file paths */
  newFiles?: Array<{ path: string; content: string }> | undefined;
  /** For move-file: source -> destination */
  moveTo?: string | undefined;
}

/**
 * Result of applying a fix
 */
export interface FixResult {
  issue: QualityIssue;
  operation: FixOperation;
  success: boolean;
  error?: string;
  /** File content before fix */
  backup?: string;
}

/**
 * Fix strategy interface
 */
export interface FixStrategy {
  /** Categories this strategy handles */
  categories: QualityCategory[];
  /** Check if this strategy can fix the issue */
  canFix(issue: QualityIssue, content: string): boolean;
  /** Generate fix operation (async to support formatting) */
  generateFix(
    issue: QualityIssue,
    content: string,
  ): Promise<FixOperation | null> | FixOperation | null;
}

/**
 * Fix difficulty level
 */
export type FixDifficulty = 'trivial' | 'safe' | 'risky';
