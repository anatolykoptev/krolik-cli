/**
 * @module commands/fix/types
 * @description Unified types for code quality analysis and auto-fixing
 *
 * Consolidates all types from former quality/ into fix/
 */

import type { OutputFormat } from '../../types';

// ============================================================================
// QUALITY ANALYSIS TYPES
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
  | 'lint';         // Universal lint rules (no-console, no-debugger, etc.)

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
}

/**
 * Suggested split point for complex functions
 */
export interface SplitSuggestion {
  /** Line number where extractable code starts */
  startLine: number;
  /** Line number where extractable code ends */
  endLine: number;
  /** Type of code block */
  type: 'if-block' | 'loop' | 'switch' | 'try-catch' | 'callback' | 'sequential';
  /** Suggested function name */
  suggestedName: string;
  /** Complexity this block contributes */
  complexity: number;
  /** Brief description */
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
  /** Cyclomatic complexity (branches count) */
  complexity: number;
  /** Suggested split points for refactoring */
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
  /** File type classification */
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
  /** Top issues sorted by severity */
  topIssues: QualityIssue[];
  /** Files that need refactoring */
  needsRefactoring: Array<{
    file: string;
    reason: string;
    suggestions: string[];
  }>;
  /** Airbnb-style recommendations */
  recommendations: RecommendationItem[];
}

/**
 * Quality check options
 */
export interface QualityOptions {
  /** Directory to analyze */
  path?: string;
  /** Include test files */
  includeTests?: boolean;
  /** Ignore console statements in CLI files (auto-detected or explicit) */
  ignoreCliConsole?: boolean;
  /** Maximum lines per function */
  maxFunctionLines?: number;
  /** Maximum functions per file */
  maxFunctionsPerFile?: number;
  /** Maximum exports per file */
  maxExportsPerFile?: number;
  /** Maximum file lines */
  maxFileLines?: number;
  /** Max cyclomatic complexity */
  maxComplexity?: number;
  /** Require JSDoc on exported functions */
  requireJSDoc?: boolean;
  /** Per-path threshold overrides */
  overrides?: ThresholdOverride[];
  /** Output format (default: 'ai') */
  format?: OutputFormat;
  /** Show only issues (not stats) */
  issuesOnly?: boolean;
  /** Filter by category */
  category?: QualityCategory;
  /** Filter by severity */
  severity?: QualitySeverity;
}

/**
 * Threshold values type
 */
export interface Thresholds {
  maxFunctionLines: number;
  maxFunctionsPerFile: number;
  maxExportsPerFile: number;
  maxFileLines: number;
  maxParams: number;
  maxImports: number;
  maxComplexity: number;
  requireJSDoc: boolean;
}

/**
 * Default thresholds
 */
export const DEFAULT_THRESHOLDS: Thresholds = {
  maxFunctionLines: 50,
  maxFunctionsPerFile: 10,
  maxExportsPerFile: 5,
  maxFileLines: 400,
  maxParams: 5,
  maxImports: 20,
  maxComplexity: 10,
  requireJSDoc: true,
};

/**
 * Per-path threshold overrides
 */
export interface ThresholdOverride {
  /** Glob pattern to match paths (e.g. "packages/api/**") */
  pattern: string;
  /** Override specific thresholds */
  thresholds: Partial<Thresholds>;
}

// ============================================================================
// FIX TYPES
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
  | 'split-file';

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
  /** Analyze only - output issues without fix plan (replaces quality command) */
  analyzeOnly?: boolean;
  /** Include Airbnb-style recommendations in output */
  recommendations?: boolean;
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
  /** Output format (default: 'ai' for AI-friendly XML) */
  format?: OutputFormat;
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
