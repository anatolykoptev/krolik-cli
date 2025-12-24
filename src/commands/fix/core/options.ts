/**
 * @module commands/fix/core/options
 * @description Options types for fix command and quality analysis
 */

import type { OutputFormat, Thresholds, ThresholdOverride } from '../../../types';
import type { QualityCategory, QualitySeverity } from './types';

// ============================================================================
// THRESHOLD TYPES
// ============================================================================
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
// ============================================================================
// QUALITY OPTIONS
// ============================================================================

/**
 * Quality check options
 */
export interface QualityOptions {
  /** Directory to analyze */
  path?: string;
  /** Include test files */
  includeTests?: boolean;
  /** Ignore console statements in CLI files */
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
  /** Output format */
  format?: OutputFormat;
  /** Show only issues (not stats) */
  issuesOnly?: boolean;
  /** Filter by category */
  category?: QualityCategory;
  /** Filter by severity */
  severity?: QualitySeverity;
}

// ============================================================================
// FIX OPTIONS
// ============================================================================

/**
 * Options for fix command
 */
export interface FixOptions {
  // ============================================================================
  // ANALYSIS OPTIONS
  // ============================================================================

  /** Path to analyze */
  path?: string;
  /** Only fix specific category */
  category?: QualityCategory;

  // ============================================================================
  // MODE OPTIONS
  // ============================================================================

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

  // ============================================================================
  // TOOL OPTIONS
  // ============================================================================

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
  /** Output format for TypeScript errors */
  typecheckFormat?: 'json' | 'xml' | 'text';

  // ============================================================================
  // OUTPUT OPTIONS
  // ============================================================================

  /** Show unified diff for dry-run */
  showDiff?: boolean;
  /** Output format (default: 'ai' for AI-friendly XML) */
  format?: OutputFormat;
  /** Generate AI report instead of applying fixes */
  aiReport?: boolean;
  /** Output path for AI report (default: .krolik/AI-REPORT.md) */
  aiReportOutput?: string;

  // ============================================================================
  // FIXER FLAGS - dynamically populated from registry
  // ============================================================================
  // These are generated from fixer metadata, but we define common ones here
  // for TypeScript support and backward compatibility

  // Lint fixers
  /** Fix console.log statements */
  fixConsole?: boolean;
  /** Fix debugger statements */
  fixDebugger?: boolean;
  /** Fix alert() calls */
  fixAlert?: boolean;

  // Type-safety fixers
  /** Fix @ts-ignore comments */
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

  // Refine fixer
  /** Fix @namespace pattern violations */
  fixRefine?: boolean;

  // Allow additional fixer flags
  [key: `fix${string}`]: boolean | undefined;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if any explicit fixer flags are set in options
 */
export function hasExplicitFixerFlags(options: FixOptions): boolean {
  return Object.keys(options).some(
    key => key.startsWith('fix') && key !== 'fix' && options[key as keyof FixOptions] === true
  );
}

/**
 * Get all enabled fixer IDs from options
 */
export function getEnabledFixerIds(options: FixOptions): string[] {
  const ids: string[] = [];

  for (const [key, value] of Object.entries(options)) {
    if (key.startsWith('fix') && key !== 'fix' && value === true) {
      // Convert fixConsole -> console
      const id = key
        .replace(/^fix/, '')
        .replace(/^[A-Z]/, c => c.toLowerCase())
        .replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
      ids.push(id);
    }
  }

  return ids;
}
