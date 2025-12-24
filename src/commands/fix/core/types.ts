/**
 * @module commands/fix/core/types
 * @description Core types for the Fixer architecture
 *
 * This module defines the base interfaces for:
 * - Quality issues (what we detect)
 * - Fix operations (how we repair)
 * - Fixer interface (self-contained fixer unit)
 */

// ============================================================================
// QUALITY ISSUE TYPES
// ============================================================================

/**
 * Severity levels for quality issues
 */
export type QualitySeverity = 'error' | 'warning' | 'info';

/**
 * Categories of quality issues
 */
export type QualityCategory =
  | 'srp'           // Single Responsibility Principle
  | 'hardcoded'     // Magic numbers, hardcoded strings
  | 'complexity'    // Function/file complexity
  | 'mixed-concerns' // UI + logic mixed
  | 'size'          // File too large
  | 'documentation' // Missing JSDoc on exports
  | 'type-safety'   // any, as, @ts-ignore usage
  | 'circular-dep'  // Circular dependencies
  | 'lint'          // Universal lint rules (no-console, no-debugger, etc.)
  | 'composite'     // Composite transform operations
  | 'agent'         // AI agent operations
  | 'refine';       // @namespace pattern violations

/**
 * A single quality issue found in a file
 */
export interface QualityIssue {
  file: string;
  line?: number;
  severity: QualitySeverity;
  category: QualityCategory;
  message: string;
  suggestion?: string;
  /** Code snippet for context */
  snippet?: string;
  /** Fixer ID that can handle this issue */
  fixerId?: string;
}

// ============================================================================
// FIX OPERATION TYPES
// ============================================================================

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
  | 'move-file'       // For refine: move to @namespace
  | 'create-barrel';  // For refine: create index.ts

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
  /** For split-file/move-file: new file paths */
  newFiles?: Array<{ path: string; content: string }> | undefined;
  /** For move-file: source -> destination */
  moveTo?: string;
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

// ============================================================================
// FIXER INTERFACE
// ============================================================================

/**
 * Fix difficulty level
 */
export type FixDifficulty = 'trivial' | 'safe' | 'risky';

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
}

// ============================================================================
// LEGACY COMPATIBILITY
// ============================================================================

/**
 * Legacy fix strategy interface (for backward compatibility)
 * @deprecated Use Fixer interface instead
 */
export interface FixStrategy {
  /** Categories this strategy handles */
  categories: QualityCategory[];
  /** Check if this strategy can fix the issue */
  canFix(issue: QualityIssue, content: string): boolean;
  /** Generate fix operation */
  generateFix(issue: QualityIssue, content: string): Promise<FixOperation | null> | FixOperation | null;
}

// ============================================================================
// ANALYSIS TYPES
// ============================================================================

/**
 * Suggested split point for complex functions
 */
export interface SplitSuggestion {
  startLine: number;
  endLine: number;
  type: 'if-block' | 'loop' | 'switch' | 'try-catch' | 'callback' | 'sequential';
  suggestedName: string;
  complexity: number;
  reason: string;
}

/**
 * Analysis of a single function
 */
export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  lines: number;
  params: number;
  isExported: boolean;
  isAsync: boolean;
  hasJSDoc: boolean;
  complexity: number;
  splitSuggestions?: SplitSuggestion[];
}

/**
 * Analysis of a single file
 */
export interface FileAnalysis {
  path: string;
  relativePath: string;
  lines: number;
  blankLines: number;
  commentLines: number;
  codeLines: number;
  functions: FunctionInfo[];
  exports: number;
  imports: number;
  fileType: 'component' | 'hook' | 'util' | 'router' | 'schema' | 'test' | 'config' | 'unknown';
  issues: QualityIssue[];
}

/**
 * Hardcoded value detected
 */
export interface HardcodedValue {
  value: string | number;
  type: 'number' | 'string' | 'url' | 'color' | 'date';
  line: number;
  context: string;
}

/**
 * Recommendation result
 */
export interface RecommendationItem {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'suggestion' | 'recommendation' | 'best-practice';
  file: string;
  line: number | undefined;
  snippet: string | undefined;
  count: number;
}

/**
 * Overall quality report
 */
export interface QualityReport {
  timestamp: string;
  projectRoot: string;
  totalFiles: number;
  analyzedFiles: number;
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    byCategory: Record<QualityCategory, number>;
  };
  files: FileAnalysis[];
  topIssues: QualityIssue[];
  needsRefactoring: Array<{
    file: string;
    reason: string;
    suggestions: string[];
  }>;
  recommendations: RecommendationItem[];
}
