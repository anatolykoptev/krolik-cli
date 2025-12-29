/**
 * @module lib/@format/constants
 * @description Formatting constants and utility functions
 *
 * Provides limits, abbreviations, and utility functions for consistent output formatting.
 * Migrated from @output-optimizer for consolidation.
 */

// =============================================================================
// FORMAT LIMITS - Maximum lengths and counts
// =============================================================================

/** Maximum path length before abbreviation */
export const MAX_PATH_LENGTH = 50;

/** Maximum items in inline lists */
export const MAX_INLINE_LIST_ITEMS = 5;

/** Maximum diff lines to include */
export const MAX_DIFF_LINES = 200;

/** Maximum memory items to show */
export const MAX_MEMORY_ITEMS = 10;

/** Maximum tree depth to show */
export const MAX_TREE_DEPTH = 3;

// =============================================================================
// ABBREVIATIONS - Compact representations for AI understanding
// =============================================================================

/** Severity level abbreviations */
export const SEVERITY_ABBREVIATIONS: Record<string, string> = {
  critical: 'CRIT',
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
};

/** Attribute name abbreviations for compact XML */
export const ATTRIBUTE_ABBREVIATIONS: Record<string, string> = {
  count: 'n',
  priority: 'p',
  severity: 's',
  importance: 'i',
  type: 't',
  truncated: 'trunc',
  original: 'orig',
};

/** Content type abbreviations */
export const TYPE_ABBREVIATIONS: Record<string, string> = {
  decision: 'DEC',
  pattern: 'PAT',
  bugfix: 'BUG',
  observation: 'OBS',
  feature: 'FEAT',
};

// =============================================================================
// TOKEN BUDGETS - Configurable limits for different modes
// =============================================================================

/** Default total budget for quick mode */
export const BUDGET_QUICK_TOTAL = 4000;

/** Default total budget for deep mode */
export const BUDGET_DEEP_TOTAL = 8000;

/** Default total budget for full mode */
export const BUDGET_FULL_TOTAL = 12000;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Abbreviate a file path to maximum length
 *
 * @example
 * abbreviatePath('src/lib/very/long/path/to/file.ts', 30)
 * // Returns: 'src/.../file.ts'
 */
export function abbreviatePath(path: string, maxLength = MAX_PATH_LENGTH): string {
  if (path.length <= maxLength) return path;

  const parts = path.split('/');
  if (parts.length <= 2) {
    return `${path.slice(0, maxLength - 3)}...`;
  }

  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';

  // Keep first and last, abbreviate middle
  const available = maxLength - first.length - last.length - 5; // 5 for '/.../'
  if (available <= 0) {
    return `${last.slice(0, maxLength - 3)}...`;
  }

  return `${first}/.../${last}`;
}

/**
 * Abbreviate severity to short code
 */
export function abbreviateSeverity(severity: string): string {
  return SEVERITY_ABBREVIATIONS[severity.toLowerCase()] ?? severity.toUpperCase().slice(0, 4);
}

// Note: estimateTokens is provided by @tokens module with more accurate implementation

/**
 * Format an inline list with truncation
 *
 * @example
 * formatInlineList(['a', 'b', 'c', 'd', 'e', 'f'], 3)
 * // Returns: 'a, b, c +3'
 */
export function formatInlineList<T>(
  items: T[],
  maxItems: number,
  formatter: (item: T) => string = String,
  separator = ', ',
): string {
  if (items.length === 0) return '';

  const visible = items.slice(0, maxItems);
  const remaining = items.length - maxItems;

  const formatted = visible.map(formatter).join(separator);
  return remaining > 0 ? `${formatted} +${remaining}` : formatted;
}
