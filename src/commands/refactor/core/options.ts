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
// REFACTOR MODE
// ============================================================================

/**
 * Refactor analysis mode
 *
 * - quick: Structure + function duplicates, no enhanced analysis (~5s)
 * - default: Structure + function duplicates + enhanced analysis (~6s)
 * - deep: Full analysis with types + git history + enhanced (~7.5s)
 *
 * All modes use SWC for fast AST parsing (10-20x faster than ts-morph)
 */
export type RefactorMode = 'quick' | 'default' | 'deep';

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
  /** Analysis mode: quick, default, or deep */
  mode?: RefactorMode;
  /** Show migration plan without applying */
  dryRun?: boolean;
  /** Apply migrations */
  apply?: boolean;
  /** Output format */
  format?: OutputFormat;
  /** Verbose output */
  verbose?: boolean;
  /** Auto-fix type duplicates */
  fixTypes?: boolean;

  // -------------------------------------------------------------------------
  // Legacy options (deprecated, mapped to mode internally)
  // -------------------------------------------------------------------------
  /** @deprecated Use mode='default' instead */
  duplicatesOnly?: boolean;
  /** @deprecated Use mode='quick' instead */
  structureOnly?: boolean;
  /** @deprecated Use mode='deep' instead */
  typesOnly?: boolean;
  /** @deprecated Use mode='deep' instead */
  includeTypes?: boolean;
}

// ============================================================================
// MIGRATION OPTIONS
// ============================================================================

/**
 * Options for migration execution
 * Note: backup/commitFirst/push removed in Epic 3 - now always-on
 */
export interface MigrationOptions {
  /** Preview changes without applying */
  dryRun?: boolean;
  /** Verbose output */
  verbose?: boolean;
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
  Pick<RefactorOptions, 'format' | 'verbose' | 'dryRun'>
> = {
  format: 'text',
  verbose: false,
  dryRun: false,
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

// ============================================================================
// MODE RESOLUTION
// ============================================================================

/**
 * Resolve effective mode from options
 *
 * Priority:
 * 1. Explicit mode option
 * 2. fixTypes implies 'deep'
 * 3. Legacy flags (structureOnly, typesOnly, includeTypes, duplicatesOnly)
 * 4. Default: 'default'
 */
export function resolveMode(options: RefactorOptions): RefactorMode {
  // 1. Explicit mode takes priority
  if (options.mode) {
    return options.mode;
  }

  // 2. fixTypes implies deep mode (need type analysis)
  if (options.fixTypes) {
    return 'deep';
  }

  // 3. Legacy flags
  if (options.structureOnly) {
    return 'quick';
  }
  if (options.typesOnly || options.includeTypes) {
    return 'deep';
  }
  if (options.duplicatesOnly) {
    return 'default';
  }

  // 4. Default mode
  return 'default';
}

/**
 * Get analysis flags based on mode
 */
export interface ModeAnalysisFlags {
  /** Run structure analysis */
  analyzeStructure: boolean;
  /** Run function duplicate detection (SWC) */
  analyzeFunctionDuplicates: boolean;
  /** Run type duplicate detection (ts-morph) */
  analyzeTypeDuplicates: boolean;
  /** Include git history in context */
  includeGitHistory: boolean;
}

/**
 * Convert mode to analysis flags
 */
export function getModeFlags(mode: RefactorMode): ModeAnalysisFlags {
  switch (mode) {
    case 'quick':
      // Quick: structure + function duplicates
      // Skips: affected imports search, enhanced analysis, XML generation
      return {
        analyzeStructure: true,
        analyzeFunctionDuplicates: true,
        analyzeTypeDuplicates: false,
        includeGitHistory: false,
      };

    case 'deep':
      // Deep: full analysis with types
      return {
        analyzeStructure: true,
        analyzeFunctionDuplicates: true,
        analyzeTypeDuplicates: true,
        includeGitHistory: true,
      };
    default:
      // Default: function duplicates + structure
      return {
        analyzeStructure: true,
        analyzeFunctionDuplicates: true,
        analyzeTypeDuplicates: false,
        includeGitHistory: false,
      };
  }
}
