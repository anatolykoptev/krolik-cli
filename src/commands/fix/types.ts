/**
 * @module commands/fix/types
 * @description Unified types for code quality analysis and auto-fixing
 *
 * Consolidates all types from former quality/ into fix/
 */

import type { OutputFormat } from '../../types';
import type { Severity } from '../../types/severity';

// ============================================================================
// QUALITY ANALYSIS TYPES
// ============================================================================

/**
 * Severity levels for quality issues
 * Re-exported from shared severity type for backwards compatibility
 */
export type QualitySeverity = Severity;

/**
 * Categories of quality issues
 */
export type QualityCategory =
  | 'srp' // Single Responsibility Principle
  | 'hardcoded' // Magic numbers, hardcoded strings
  | 'complexity' // Function/file complexity
  | 'mixed-concerns' // UI + logic mixed
  | 'size' // File too large
  | 'documentation' // Missing JSDoc on exports
  | 'type-safety' // any, as, @ts-ignore usage
  | 'circular-dep' // Circular dependencies
  | 'lint' // Universal lint rules (no-console, no-debugger, etc.)
  | 'composite' // Composite transform operations
  | 'agent' // AI agent operations
  | 'refine' // @namespace structure violations
  | 'security' // Command injection, path traversal, SQL injection
  | 'modernization' // Legacy patterns (require, sync fs)
  | 'i18n'; // Hardcoded text that should be translated

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
  /** Fixer ID that detected this issue */
  fixerId?: string;
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
  /** Include risky fixers in analysis */
  includeRisky?: boolean;
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
 * Options for fix command
 */
export interface FixOptions {
  /** Path to analyze */
  path?: string;
  /** Only fix specific category */
  category?: QualityCategory;
  /** Dry run - show what would be fixed without applying */
  dryRun?: boolean;
  /** Include Airbnb-style recommendations in output */
  recommendations?: boolean;
  /** Auto-confirm all fixes */
  yes?: boolean;
  /** Only fix trivial issues (console, debugger, etc) */
  trivialOnly?: boolean;
  /** Fix trivial + safe issues (excludes risky) */
  safe?: boolean;

  // ============================================================================
  // AUDIT INTEGRATION (--from-audit)
  // ============================================================================

  /** Use cached audit data instead of running analysis */
  fromAudit?: boolean;
  /** Only fix quick wins from audit (auto-fixable issues) */
  quickWinsOnly?: boolean;

  // ============================================================================
  // REFACTOR INTEGRATION (--from-refactor)
  // ============================================================================

  /** Use cached refactor analysis for auto-fixable recommendations */
  fromRefactor?: boolean;
  /** Include risky fixers (requires explicit confirmation) */
  all?: boolean;
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

  // ============================================================================
  // FIXER FLAGS - enable/disable specific fixers
  // ============================================================================

  // Lint fixers
  /** Fix console.log statements */
  fixConsole?: boolean;
  /** Fix debugger statements */
  fixDebugger?: boolean;
  /** Fix alert() calls */
  fixAlert?: boolean;

  // Type-safety fixers
  /** Fix @ts-expect-error comments */
  fixTsIgnore?: boolean;
  /** Fix `any` type usage */
  fixAny?: boolean;

  // Complexity fixers
  /** Fix high complexity functions */
  fixComplexity?: boolean;
  /** Fix long functions (extract helpers) */
  fixLongFunctions?: boolean;

  // Hardcoded fixers
  /** Fix magic numbers */
  fixMagicNumbers?: boolean;
  /** Fix hardcoded URLs */
  fixUrls?: boolean;

  // SRP fixers
  /** Fix SRP violations (too many exports/functions) */
  fixSrp?: boolean;

  // Refactor integration fixers
  /** Fix duplicate functions (merge) */
  fixDuplicate?: boolean;
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

// ============================================================================
// FIXER FILTERING
// ============================================================================

/**
 * Check if a specific fixer is enabled for an issue
 *
 * Logic:
 * - If issue has fixerId, use registry-based filtering
 * - Otherwise, fall back to legacy category/message-based filtering
 *
 * For registry-based:
 * - If no fixer flags are set, all fixers are enabled (default behavior)
 * - If any --fix-X flag is set, only those fixers are enabled
 * - If --no-X flag is set, that specific fixer is disabled
 */
export function isFixerEnabled(issue: QualityIssue, options: FixOptions): boolean {
  // Use registry-based filtering for issues with fixerId
  if (issue.fixerId) {
    return isFixerEnabledByRegistry(issue.fixerId, options);
  }

  // Fall back to legacy logic for old analyzer issues
  return isFixerEnabledLegacy(issue, options);
}

/**
 * Registry-based fixer check
 */
function isFixerEnabledByRegistry(fixerId: string, options: FixOptions): boolean {
  // Lazy import to avoid circular dependency
  const { registry } = require('./fixers');

  const enabledFixers = registry.getEnabled(options as Record<string, unknown>);
  return enabledFixers.some((f: { metadata: { id: string } }) => f.metadata.id === fixerId);
}

// ============================================================================
// FIXER MATCHING CONFIGURATION
// ============================================================================

type FixerOptionKey = keyof Pick<
  FixOptions,
  | 'fixConsole'
  | 'fixDebugger'
  | 'fixAlert'
  | 'fixTsIgnore'
  | 'fixAny'
  | 'fixComplexity'
  | 'fixLongFunctions'
  | 'fixMagicNumbers'
  | 'fixUrls'
  | 'fixSrp'
>;

interface FixerMatcher {
  category: QualityCategory;
  patterns: string[];
  optionKey: FixerOptionKey;
}

/**
 * Lookup table for category+message → option mapping
 */
const FIXER_MATCHERS: FixerMatcher[] = [
  // Lint category
  { category: 'lint', patterns: ['console'], optionKey: 'fixConsole' },
  { category: 'lint', patterns: ['debugger'], optionKey: 'fixDebugger' },
  { category: 'lint', patterns: ['alert'], optionKey: 'fixAlert' },
  // Type-safety category
  { category: 'type-safety', patterns: ['@ts-ignore', 'ts-ignore'], optionKey: 'fixTsIgnore' },
  { category: 'type-safety', patterns: ['any'], optionKey: 'fixAny' },
  // Complexity category
  { category: 'complexity', patterns: ['complexity', 'cognitive'], optionKey: 'fixComplexity' },
  { category: 'complexity', patterns: ['long', 'lines'], optionKey: 'fixLongFunctions' },
  // Hardcoded category
  { category: 'hardcoded', patterns: ['number', 'magic'], optionKey: 'fixMagicNumbers' },
  { category: 'hardcoded', patterns: ['url', 'http'], optionKey: 'fixUrls' },
  // SRP category (matches all messages)
  { category: 'srp', patterns: [], optionKey: 'fixSrp' },
];

/**
 * Check if any explicit fixer flag is set
 */
function hasExplicitFixerFlags(options: FixOptions): boolean {
  return !!(
    options.fixConsole ||
    options.fixDebugger ||
    options.fixAlert ||
    options.fixTsIgnore ||
    options.fixAny ||
    options.fixComplexity ||
    options.fixLongFunctions ||
    options.fixMagicNumbers ||
    options.fixUrls ||
    options.fixSrp
  );
}

/**
 * Find matching fixer for an issue
 */
function findMatchingFixer(category: QualityCategory, message: string): FixerMatcher | undefined {
  const msg = message.toLowerCase();
  return FIXER_MATCHERS.find(
    (matcher) =>
      matcher.category === category &&
      (matcher.patterns.length === 0 || matcher.patterns.some((p) => msg.includes(p))),
  );
}

/**
 * Check if fixer is enabled based on option value and explicit flags
 */
function isFixerOptionEnabled(optionValue: boolean | undefined, hasExplicit: boolean): boolean {
  if (optionValue === false) return false;
  if (hasExplicit) return !!optionValue;
  return true;
}

/**
 * Legacy category/message-based fixer check
 */
function isFixerEnabledLegacy(issue: QualityIssue, options: FixOptions): boolean {
  const hasExplicit = hasExplicitFixerFlags(options);
  const matcher = findMatchingFixer(issue.category, issue.message);

  if (matcher) {
    return isFixerOptionEnabled(options[matcher.optionKey], hasExplicit);
  }

  // Default: if no explicit flags, enable; otherwise disable
  return !hasExplicit;
}

/**
 * Filter issues based on fixer flags
 */
export function filterIssuesByFixerFlags(
  issues: QualityIssue[],
  options: FixOptions,
): QualityIssue[] {
  return issues.filter((issue) => isFixerEnabled(issue, options));
}
