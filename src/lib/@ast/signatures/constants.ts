/**
 * @module lib/parsing/signatures/constants
 * @description Named constants for signature extraction
 *
 * Eliminates magic numbers and provides clear, documented configuration values.
 *
 * @example
 * import { DEFAULT_MAX_SIGNATURE_LENGTH, BRACKET_DELTAS } from '@/lib/@ast/signatures/constants';
 *
 * const truncatedSig = signature.slice(0, DEFAULT_MAX_SIGNATURE_LENGTH);
 */

import type { RequiredSignatureOptions } from './types';

// ============================================================================
// SIGNATURE EXTRACTION DEFAULTS
// ============================================================================

/**
 * Default maximum signature length before truncation (characters)
 *
 * Chosen to balance readability with context window efficiency.
 * Most function signatures fit within 200 chars.
 */
export const DEFAULT_MAX_SIGNATURE_LENGTH = 200;

/**
 * Default extraction options
 *
 * Conservative defaults that exclude internal/private symbols
 * for cleaner public API documentation.
 */
export const DEFAULT_SIGNATURE_OPTIONS: RequiredSignatureOptions = {
  includePrivate: false,
  includeInternal: false,
  maxLength: DEFAULT_MAX_SIGNATURE_LENGTH,
};

// ============================================================================
// TEXT PROCESSING CONSTANTS
// ============================================================================

/**
 * Maximum context snippet length for display (characters)
 *
 * Used when extracting code snippets for error messages or summaries.
 */
export const MAX_CONTEXT_SNIPPET_LENGTH = 80;

/**
 * Ellipsis suffix for truncated text
 */
export const TRUNCATION_SUFFIX = '...';

/**
 * Length of truncation suffix (used in calculations)
 */
export const TRUNCATION_SUFFIX_LENGTH = 3;

// ============================================================================
// BRACKET MATCHING
// ============================================================================

/**
 * Bracket depth changes for signature boundary detection
 *
 * Maps bracket characters to [parenDelta, angleDelta] tuples.
 * Used to track nesting level when finding the end of a signature.
 *
 * @example
 * const delta = BRACKET_DELTAS['('];
 * // Returns [1, 0] - parenthesis increments paren depth
 *
 * const delta = BRACKET_DELTAS['<'];
 * // Returns [0, 1] - angle bracket increments angle depth
 */
export const BRACKET_DELTAS: Record<string, readonly [number, number]> = {
  '(': [1, 0],
  ')': [-1, 0],
  '<': [0, 1],
  '>': [0, -1],
} as const;

// ============================================================================
// BODY DETECTION
// ============================================================================

/**
 * Opening brace character that marks start of function/class body
 */
export const BODY_START_BRACE = '{';

/**
 * Arrow function operator (without body brace)
 */
export const ARROW_OPERATOR = '=>';

/**
 * Assignment operator (marks end of const/type signature)
 */
export const ASSIGNMENT_OPERATOR = '=';

// ============================================================================
// PREFIX STRINGS
// ============================================================================

/**
 * Private method prefix (ES private fields)
 */
export const PRIVATE_PREFIX = '#';

/**
 * Internal symbol prefix (convention)
 */
export const INTERNAL_PREFIX = '_';

/**
 * Export keyword
 */
export const EXPORT_KEYWORD = 'export';

// ============================================================================
// KEYWORD PATTERNS
// ============================================================================

/**
 * Keywords that indicate variable declaration
 */
export const VARIABLE_KEYWORDS = ['const', 'let', 'var'] as const;

/**
 * Type for variable declaration keywords
 */
export type VariableKeyword = (typeof VARIABLE_KEYWORDS)[number];

/**
 * Keywords that indicate class declaration
 */
export const CLASS_KEYWORD = 'class';

/**
 * Keywords that indicate interface declaration
 */
export const INTERFACE_KEYWORD = 'interface';

/**
 * Keywords that indicate function declaration
 */
export const FUNCTION_KEYWORD = 'function';

// ============================================================================
// SWC OFFSET CONSTANTS
// ============================================================================

/**
 * SWC uses 1-based byte offsets (first character is at offset 1)
 */
export const SWC_OFFSET_BASE = 1;
