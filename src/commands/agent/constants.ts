/**
 * @module commands/agent/constants
 * @description Constants for agent command
 *
 * Centralized magic numbers and configuration values.
 * Import from @core/constants for shared thresholds.
 */

// ============================================================================
// TRUNCATION LIMITS
// ============================================================================

/**
 * Text truncation limits for various outputs
 */
export const TRUNCATION = {
  /** Description in text formatters */
  DESCRIPTION_SHORT: 60,
  /** Description in list output */
  DESCRIPTION_LONG: 80,
  /** Task title for memory */
  TASK_TITLE: 50,
  /** Library doc snippet */
  DOC_SNIPPET: 300,
  /** Git diff output */
  GIT_DIFF: 5000,
} as const;

// ============================================================================
// COUNT LIMITS
// ============================================================================

/**
 * Limits for various collections
 */
export const LIMITS = {
  /** Library docs to fetch */
  LIBRARY_DOCS: 5,
  /** Memories to load */
  MEMORIES: 5,
  /** Similar agents to suggest */
  SIMILAR_AGENTS: 5,
  /** Agent names to save in orchestration */
  ORCHESTRATION_AGENTS_SAVE: 5,
  /** Default agents to run when no primary */
  DEFAULT_AGENTS_TO_RUN: 3,
  /** Primary agents to add to plan */
  PRIMARY_AGENTS_TO_ADD: 2,
  /** Fallback agents when no primary */
  FALLBACK_AGENTS: 1,
  /** Critical memories fallback */
  CRITICAL_MEMORIES: 2,
  /** Recent decisions fallback */
  RECENT_DECISIONS: 3,
} as const;

// ============================================================================
// MEMORY SEARCH
// ============================================================================

/**
 * Memory search configuration
 */
export const MEMORY_SEARCH = {
  /** Minimum relevance score for memory results */
  MIN_RELEVANCE: 20,
  /** Search limit multiplier */
  LIMIT_MULTIPLIER: 2,
} as const;

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Confidence calculation constants
 */
export const CONFIDENCE = {
  /** Score divisor for confidence calculation */
  SCORE_DIVISOR: 3,
} as const;
