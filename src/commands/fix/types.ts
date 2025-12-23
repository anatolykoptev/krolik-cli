/**
 * @module commands/fix/types
 * @description Types for autofixer system
 */

import type { QualityIssue, QualityCategory } from '../quality/types';

/**
 * Fix action types
 */
export type FixAction =
  | 'delete-line'      // Remove a line
  | 'replace-line'     // Replace line content
  | 'replace-range'    // Replace range of lines
  | 'insert-before'    // Insert before line
  | 'insert-after'     // Insert after line
  | 'wrap-function'    // Wrap code in a function
  | 'extract-function' // Extract code to new function
  | 'split-file';      // Split file into multiple files

/**
 * A single fix operation
 */
export interface FixOperation {
  action: FixAction;
  file: string;
  line?: number;
  endLine?: number;
  oldCode?: string;
  newCode?: string;
  /** For extract-function: name of new function */
  functionName?: string;
  /** For split-file: new file paths */
  newFiles?: Array<{ path: string; content: string }>;
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
  generateFix(issue: QualityIssue, content: string): Promise<FixOperation | null> | FixOperation | null;
}

/**
 * Options for fix command
 */
export interface FixOptions {
  /** Path to analyze */
  path?: string;
  /** Only fix specific category */
  category?: QualityCategory;
  /** Dry run - show what would be fixed without applying */
  dryRun?: boolean;
  /** Auto-confirm all fixes */
  yes?: boolean;
  /** Only fix trivial issues (console, debugger, etc) */
  trivialOnly?: boolean;
  /** Create backup before fixing */
  backup?: boolean;
  /** Max fixes to apply */
  limit?: number;
  /** Run Biome auto-fix before custom fixes */
  biome?: boolean;
  /** Only run Biome (skip custom fixes) */
  biomeOnly?: boolean;
  /** Skip Biome even if available */
  noBiome?: boolean;
  /** Run TypeScript type check first */
  typecheck?: boolean;
  /** Only run TypeScript check (skip fixes) */
  typecheckOnly?: boolean;
  /** Skip TypeScript check */
  noTypecheck?: boolean;
  /** Output format for TypeScript errors (json, xml, text) */
  typecheckFormat?: 'json' | 'xml' | 'text';
  /** Show unified diff for dry-run */
  showDiff?: boolean;
}

/**
 * Fix difficulty level
 */
export type FixDifficulty = 'trivial' | 'safe' | 'risky';

/**
 * Categorize fix difficulty
 */
export function getFixDifficulty(issue: QualityIssue): FixDifficulty {
  const { category, message } = issue;

  // Trivial: can always safely fix
  if (category === 'lint') {
    if (message.includes('console') || message.includes('debugger') || message.includes('alert')) {
      return 'trivial';
    }
  }

  // Safe: unlikely to break anything
  if (category === 'type-safety') {
    if (message.includes('@ts-ignore') || message.includes('@ts-nocheck')) {
      return 'safe';
    }
  }

  // Everything else is risky
  return 'risky';
}
