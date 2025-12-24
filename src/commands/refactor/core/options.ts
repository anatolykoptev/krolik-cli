/**
 * @module commands/refactor/core/options
 * @description Command options for refactor command
 */

// ============================================================================
// OUTPUT FORMAT
// ============================================================================

/**
 * Output format options
 */
export type OutputFormat = 'text' | 'json' | 'xml';

// ============================================================================
// REFACTOR OPTIONS
// ============================================================================

/**
 * Refactor command options
 */
export interface RefactorOptions {
  /** Target directory to analyze */
  path?: string;
  /** Monorepo package to analyze (e.g., 'web', 'api') */
  package?: string;
  /** Analyze all packages in monorepo */
  allPackages?: boolean;
  /** Only analyze duplicates */
  duplicatesOnly?: boolean;
  /** Only analyze structure */
  structureOnly?: boolean;
  /** Only analyze type/interface duplicates */
  typesOnly?: boolean;
  /** Include type/interface duplicate detection */
  includeTypes?: boolean;
  /** Show migration plan without applying */
  dryRun?: boolean;
  /** Apply migrations */
  apply?: boolean;
  /** Auto-confirm all actions */
  yes?: boolean;
  /** Output format */
  format?: OutputFormat;
  /** Verbose output */
  verbose?: boolean;
  /** Use AI-native enhanced output (auto-enabled for XML) */
  aiNative?: boolean;
  /** Create git backup before applying migrations (default: true) */
  backup?: boolean;
  /** Commit uncommitted changes before applying (default: true) */
  commitFirst?: boolean;
  /** Push auto-commit to remote (default: true) */
  push?: boolean;
  /** Generate ai-config.ts for AI assistants */
  generateConfig?: boolean;
  /** Auto-fix type duplicates */
  fixTypes?: boolean;
  /** Only fix 100% identical types (safe mode, default for --fix-types) */
  fixTypesIdenticalOnly?: boolean;
  /** Use fast SWC parser for duplicate detection (default: true) */
  useFastParser?: boolean;
}

// ============================================================================
// MIGRATION OPTIONS
// ============================================================================

/**
 * Options for migration execution
 */
export interface MigrationOptions {
  /** Preview changes without applying */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Create backup before applying */
  backup?: boolean;
}

// ============================================================================
// ANALYSIS OPTIONS
// ============================================================================

/**
 * Options for analysis
 */
export interface AnalysisOptions {
  /** Skip duplicate analysis */
  skipDuplicates?: boolean;
  /** Skip structure analysis */
  skipStructure?: boolean;
  /** Include enhanced AI analysis */
  enhanced?: boolean;
}

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * Default refactor options
 */
export const DEFAULT_REFACTOR_OPTIONS: Required<
  Pick<RefactorOptions, 'format' | 'backup' | 'verbose' | 'dryRun' | 'useFastParser'>
> = {
  format: 'text',
  backup: true,
  verbose: false,
  dryRun: false,
  useFastParser: true, // SWC parser is 10-20x faster than ts-morph
};

/**
 * Merge options with defaults
 */
export function mergeOptions(options: RefactorOptions): RefactorOptions {
  return {
    ...DEFAULT_REFACTOR_OPTIONS,
    ...options,
  };
}
