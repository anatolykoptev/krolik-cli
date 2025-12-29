/**
 * @module lib/@format/core
 * @description Core formatting utilities - Layer 0 (no dependencies)
 *
 * Provides foundational utilities used by other format modules:
 * - Constants: limits, abbreviations, budgets
 * - Text: truncation, padding, case conversion
 */

// Constants and abbreviation utilities
export {
  // Abbreviation maps
  ATTRIBUTE_ABBREVIATIONS,
  // Utility functions
  abbreviatePath,
  abbreviateSeverity,
  // Token budgets
  BUDGET_DEEP_TOTAL,
  BUDGET_FULL_TOTAL,
  BUDGET_QUICK_TOTAL,
  formatInlineList,
  // Limits
  MAX_DIFF_LINES,
  MAX_INLINE_LIST_ITEMS,
  MAX_MEMORY_ITEMS,
  MAX_PATH_LENGTH,
  MAX_TREE_DEPTH,
  SEVERITY_ABBREVIATIONS,
  TYPE_ABBREVIATIONS,
} from './constants';

// Text formatting utilities
export {
  alignColumns,
  center,
  dedent,
  formatCount,
  indent,
  padLeft,
  padRight,
  pluralize,
  stripAnsi,
  toCamelCase,
  toConstantCase,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  truncate,
  truncateLines,
  truncateMiddle,
  wordWrap,
} from './text';
