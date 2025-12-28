/**
 * @module commands/fix/strategies/complexity/patterns
 * @description Patterns and constants for complexity detection
 */

import type { NumberRange } from '../../core';

// ============================================================================
// FIXABLE PATTERNS
// ============================================================================

/**
 * Patterns to detect fixable complexity issues from quality messages
 */
export const PATTERNS = {
  /** Matches: "nesting depth" */
  NESTING: /nesting depth/i,

  /** Matches: "has complexity 25 (max: 10)" - captures the number */
  COMPLEXITY: /has\s+complexity\s+(\d+)/i,

  /** Matches: "has 50 lines" or "function ... 50 lines" - captures the number */
  LONG_FUNCTION: /(\d+)\s*lines/i,
} as const;

// ============================================================================
// THRESHOLDS
// ============================================================================

/** Complexity range we can handle (10-120) */
export const COMPLEXITY_RANGE: NumberRange = {
  min: 10,
  max: 120,
};

/** Line count range for long function fixes (50-200) */
export const LONG_FUNCTION_RANGE: NumberRange = {
  min: 50,
  max: 200,
};

/** Minimum block size for extraction (5+ lines) */
export const MIN_BLOCK_SIZE = 5;

/** Minimum conditions for if-chain to map conversion */
export const MIN_IF_CHAIN_LENGTH = 4;

/** Minimum statements for early return transformation */
export const MIN_STATEMENTS_FOR_EARLY_RETURN = 3;

// ============================================================================
// FUNCTION NAME MAPPING
// ============================================================================

/**
 * Keyword to function name mapping for extracted functions
 * Used to generate meaningful names from code content
 */
export const FUNCTION_NAME_MAP: Record<string, string> = {
  // Validation
  valid: 'validateInput',
  check: 'checkCondition',

  // Error handling
  error: 'handleError',
  catch: 'handleError',

  // Data fetching
  fetch: 'fetchData',
  request: 'fetchData',

  // Data transformation
  transform: 'transformData',
  map: 'transformData',
  filter: 'filterItems',
  sort: 'sortItems',

  // Rendering
  render: 'renderContent',
  component: 'renderContent',

  // Lifecycle
  init: 'initialize',
  setup: 'initialize',
  clean: 'cleanup',
  dispose: 'cleanup',

  // Configuration
  config: 'processConfig',
  option: 'processConfig',

  // I/O
  format: 'formatOutput',
  parse: 'parseInput',

  // CRUD
  update: 'updateState',
  create: 'createItem',
  delete: 'removeItem',
  remove: 'removeItem',
};

/** Default function name when no keyword matches */
export const DEFAULT_FUNCTION_NAME = 'processBlock';
