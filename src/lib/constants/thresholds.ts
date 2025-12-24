/**
 * @module lib/constants/thresholds
 * @description Consolidated numeric thresholds for analysis and effort estimation
 *
 * Consolidates thresholds from:
 * - src/commands/fix/analyzers/thresholds.ts (analysis thresholds)
 * - src/commands/fix/reporter/effort.ts (effort estimation)
 * - src/commands/context/formatters/ai/constants.ts (output limits)
 */

// ============================================================================
// ANALYSIS THRESHOLDS
// ============================================================================

/**
 * Code quality analysis thresholds
 * Used to detect when code exceeds acceptable limits
 */
export const ANALYSIS_THRESHOLDS = {
  /** Maximum lines per function before flagging as too long */
  MAX_FUNCTION_LINES: 50,

  /** Maximum lines per file before flagging as too large */
  MAX_FILE_LINES: 400,

  /** Maximum exports per file before flagging as over-exporting */
  MAX_EXPORTS_PER_FILE: 5,

  /** Maximum parameters per function before flagging */
  MAX_PARAMS: 5,

  /** Maximum imports per file before flagging */
  MAX_IMPORTS: 20,

  /** Maximum cyclomatic complexity before flagging */
  MAX_COMPLEXITY: 10,

  /** Maximum functions per file before flagging */
  MAX_FUNCTIONS_PER_FILE: 10,
} as const;

// ============================================================================
// EFFORT ESTIMATION THRESHOLDS
// ============================================================================

/**
 * Effort level thresholds (in minutes)
 * Used to categorize fixes by time required
 */
export const EFFORT_THRESHOLDS = {
  /** Trivial fixes: <= 5 minutes (e.g., console.log, debugger) */
  TRIVIAL: 5,

  /** Small fixes: <= 15 minutes (e.g., simple refactoring) */
  SMALL: 15,

  /** Medium fixes: <= 30 minutes (e.g., extract constant) */
  MEDIUM: 30,

  /** Large fixes: <= 60 minutes (e.g., complex refactoring) */
  LARGE: 60,

  // Complex: > 60 minutes (anything above large)
} as const;

/**
 * Base effort by category (in minutes)
 * Used as starting point for effort calculation
 */
export const CATEGORY_BASE_EFFORT = {
  lint: 2, // Simple delete/replace
  'type-safety': 10, // May need type analysis
  hardcoded: 5, // Extract to constant
  documentation: 5, // Add JSDoc
  complexity: 20, // May need refactoring
  srp: 30, // File splitting
  'mixed-concerns': 25, // Separation of concerns
  size: 40, // Large refactoring
  'circular-dep': 30, // Dependency restructuring
  composite: 15, // Multi-file operation
  agent: 20, // AI-assisted fix
  refine: 35, // @namespace structure migration
} as const;

/**
 * Severity multipliers for effort calculation
 */
export const SEVERITY_MULTIPLIER = {
  error: 1.5,
  warning: 1.0,
  info: 0.7,
} as const;

/**
 * Difficulty multipliers for effort calculation
 */
export const DIFFICULTY_MULTIPLIER = {
  trivial: 0.5,
  safe: 1.0,
  risky: 2.0,
} as const;

// ============================================================================
// OUTPUT LIMITS
// ============================================================================

/**
 * Context formatter and output limits
 * Used to control how much information is displayed
 */
export const OUTPUT_LIMITS = {
  /** Default maximum items to display */
  MAX_ITEMS: 6,

  /** Small item limit */
  SMALL: 3,

  /** Medium item limit */
  MEDIUM: 5,

  /** Large item limit */
  LARGE: 8,

  /** Maximum size for various outputs */
  MAX_SIZE: 15,

  /** Default page size for pagination */
  PAGE_SIZE: 20,
} as const;
