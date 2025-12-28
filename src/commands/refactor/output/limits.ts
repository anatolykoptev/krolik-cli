/**
 * @module commands/refactor/output/limits
 * @description Output limits for token budget control
 *
 * Defines section limits by output level:
 * - summary: ~10K tokens (top insights only)
 * - standard: ~25K tokens (balanced limits)
 * - full: unlimited (current behavior)
 */

// ============================================================================
// TYPES
// ============================================================================

export type OutputLevel = 'summary' | 'standard' | 'full';

/**
 * Limits for each section in the output
 */
export interface SectionLimits {
  /** Max migration actions to include */
  migrationActions: number;
  /** Max recommendations to include */
  recommendations: number;
  /** Max duplicates per category (functions, types) */
  duplicates: number;
  /** Max hotspots to include */
  hotspots: number;
  /** Max coupling metrics */
  couplingMetrics: number;
  /** Max phases in safe-order */
  safeOrderPhases: number;
  /** Max modules in reusable-modules */
  reusableModules: number;
  /** Max file issues per severity */
  fileSizeIssues: number;
  /** Max affected files per action/recommendation */
  affectedFiles: number;
  /** Max locations per duplicate */
  duplicateLocations: number;
  /** Include static sections (ai-navigation, patterns) */
  includeStaticSections: boolean;
  /** Collapse rollback-points into count only */
  collapseRollbackPoints: boolean;
  /** Include domains section */
  includeDomains: boolean;
}

// ============================================================================
// LIMITS BY LEVEL
// ============================================================================

export const LIMITS: Record<OutputLevel, SectionLimits> = {
  /**
   * Summary level: ~10K tokens
   * Only critical insights for quick overview
   */
  summary: {
    migrationActions: 10,
    recommendations: 5,
    duplicates: 5,
    hotspots: 5,
    couplingMetrics: 5,
    safeOrderPhases: 5,
    reusableModules: 5,
    fileSizeIssues: 3,
    affectedFiles: 2,
    duplicateLocations: 2,
    includeStaticSections: false,
    collapseRollbackPoints: true,
    includeDomains: false,
  },

  /**
   * Standard level: ~25K tokens
   * Balanced output for most use cases
   */
  standard: {
    migrationActions: 30,
    recommendations: 15,
    duplicates: 15,
    hotspots: 10,
    couplingMetrics: 10,
    safeOrderPhases: 10,
    reusableModules: 15,
    fileSizeIssues: 10,
    affectedFiles: 3,
    duplicateLocations: 3,
    includeStaticSections: false,
    collapseRollbackPoints: true,
    includeDomains: true,
  },

  /**
   * Full level: unlimited
   * Complete output (current behavior)
   */
  full: {
    migrationActions: Infinity,
    recommendations: Infinity,
    duplicates: Infinity,
    hotspots: Infinity,
    couplingMetrics: Infinity,
    safeOrderPhases: Infinity,
    reusableModules: Infinity,
    fileSizeIssues: Infinity,
    affectedFiles: 5,
    duplicateLocations: 5,
    includeStaticSections: true,
    collapseRollbackPoints: false,
    includeDomains: true,
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Select output level based on token budget
 */
export function selectOutputLevel(tokenBudget?: number): OutputLevel {
  if (!tokenBudget) return 'standard'; // Default to standard for MCP
  if (tokenBudget <= 15_000) return 'summary';
  if (tokenBudget <= 40_000) return 'standard';
  return 'full';
}

/**
 * Get limits for a specific output level
 */
export function getLimits(level: OutputLevel): SectionLimits {
  return LIMITS[level];
}

/**
 * Apply limit to an array, returning limited items and overflow count
 */
export function applyLimit<T>(items: T[], limit: number): { items: T[]; overflow: number } {
  if (limit === Infinity || items.length <= limit) {
    return { items, overflow: 0 };
  }
  return {
    items: items.slice(0, limit),
    overflow: items.length - limit,
  };
}
