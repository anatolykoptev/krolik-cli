/**
 * @module lib/@patterns/complexity
 * @description Unified complexity patterns - single source of truth
 *
 * Used by:
 * - quality/analyzers/complexity.ts (detection)
 * - fix/strategies/complexity (fixing)
 */

import { SyntaxKind } from 'ts-morph';

// ============================================================================
// AST COMPLEXITY CALCULATION
// ============================================================================

/**
 * SyntaxKinds that increase cyclomatic complexity
 */
export const COMPLEXITY_SYNTAX_KINDS = new Set([
  SyntaxKind.IfStatement,
  SyntaxKind.ForStatement,
  SyntaxKind.ForInStatement,
  SyntaxKind.ForOfStatement,
  SyntaxKind.WhileStatement,
  SyntaxKind.DoStatement,
  SyntaxKind.CaseClause,
  SyntaxKind.CatchClause,
  SyntaxKind.ConditionalExpression,
]);

/**
 * Binary operators that add to complexity
 */
export const COMPLEXITY_OPERATORS = new Set([
  SyntaxKind.AmpersandAmpersandToken, // &&
  SyntaxKind.BarBarToken, // ||
  SyntaxKind.QuestionQuestionToken, // ??
]);

/**
 * Regex fallback patterns for complexity calculation
 */
export const COMPLEXITY_REGEX_PATTERNS = [
  /\bif\s*\(/g,
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\bdo\s*\{/g,
  /\bcase\s+[^:]+:/g,
  /\bcatch\s*\(/g,
  /\?\s*[^:]+:/g,
  /&&/g,
  /\|\|/g,
  /\?\?/g,
];

// ============================================================================
// THRESHOLDS
// ============================================================================

/**
 * Number range type
 */
export interface NumberRange {
  min: number;
  max: number;
}

/**
 * Complexity range we can handle (10-120)
 */
export const COMPLEXITY_RANGE: NumberRange = {
  min: 10,
  max: 120,
};

/**
 * Line count range for long function fixes (50-200)
 */
export const LONG_FUNCTION_RANGE: NumberRange = {
  min: 50,
  max: 200,
};

/**
 * Minimum block size for extraction (5+ lines)
 */
export const MIN_BLOCK_SIZE = 5;

/**
 * Minimum complexity for block extraction
 */
export const MIN_BLOCK_COMPLEXITY = 2;

/**
 * Minimum conditions for if-chain to map conversion
 */
export const MIN_IF_CHAIN_LENGTH = 4;

/**
 * Minimum statements for early return transformation
 */
export const MIN_STATEMENTS_FOR_EARLY_RETURN = 3;

/**
 * Default max nesting depth
 */
export const DEFAULT_MAX_NESTING = 4;

/**
 * Default max function complexity
 */
export const DEFAULT_MAX_COMPLEXITY = 10;

// ============================================================================
// DETECTION PATTERNS (for fix strategies)
// ============================================================================

/**
 * Patterns to detect fixable complexity issues from quality messages
 */
export const DETECTION_PATTERNS = {
  /** Matches: "nesting depth" */
  NESTING: /nesting depth/i,
  /** Matches: "has complexity 25 (max: 10)" - captures the number */
  COMPLEXITY: /has\s+complexity\s+(\d+)/i,
  /** Matches: "has 50 lines" or "function ... 50 lines" - captures the number */
  LONG_FUNCTION: /(\d+)\s*lines/i,
} as const;

// ============================================================================
// FUNCTION NAME GENERATION
// ============================================================================

/**
 * Keyword to function name mapping for extracted functions
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

/**
 * Default function name when no keyword matches
 */
export const DEFAULT_FUNCTION_NAME = 'processBlock';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate complexity using regex (fallback)
 */
export function calculateComplexityRegex(code: string): number {
  let complexity = 1;

  for (const pattern of COMPLEXITY_REGEX_PATTERNS) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Check if complexity is in fixable range
 */
export function isFixableComplexity(complexity: number): boolean {
  return complexity >= COMPLEXITY_RANGE.min && complexity <= COMPLEXITY_RANGE.max;
}

/**
 * Check if function length is in fixable range
 */
export function isFixableFunctionLength(lines: number): boolean {
  return lines >= LONG_FUNCTION_RANGE.min && lines <= LONG_FUNCTION_RANGE.max;
}

/**
 * Get function name from code content keywords
 */
export function getFunctionNameFromKeywords(codeSnippet: string): string {
  const lowerCode = codeSnippet.toLowerCase();

  for (const [keyword, name] of Object.entries(FUNCTION_NAME_MAP)) {
    if (lowerCode.includes(keyword)) {
      return name;
    }
  }

  return DEFAULT_FUNCTION_NAME;
}
