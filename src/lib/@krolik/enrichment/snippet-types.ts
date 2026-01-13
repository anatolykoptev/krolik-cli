/**
 * @module commands/audit/enrichment/snippet-types
 * @description Types for code snippet extraction and complexity breakdown
 */

// ============================================================================
// CODE SNIPPET TYPES
// ============================================================================

/**
 * Extracted code snippet with line range
 */
export interface CodeSnippet {
  /** The actual code content */
  code: string;

  /** Start line (1-indexed) */
  startLine: number;

  /** End line (1-indexed) */
  endLine: number;

  /** Line to highlight (usually the issue line) */
  highlightLine: number;

  /** Whether the snippet was truncated */
  truncated: boolean;
}

// ============================================================================
// COMPLEXITY BREAKDOWN TYPES
// ============================================================================

/**
 * Type of control flow branch contributing to complexity
 */
export type BranchType =
  | 'if'
  | 'else-if'
  | 'else'
  | 'for'
  | 'for-in'
  | 'for-of'
  | 'while'
  | 'do-while'
  | 'switch'
  | 'case'
  | 'catch'
  | 'ternary'
  | 'logical-and'
  | 'logical-or'
  | 'nullish-coalesce';

/**
 * A single branch contributing to cyclomatic complexity
 */
export interface ComplexityBranch {
  /** Line number (1-indexed) */
  line: number;

  /** Type of branch */
  type: BranchType;

  /** Human-readable reason */
  reason: string;

  /** Nesting depth (0 = top level) */
  depth: number;
}

/**
 * Complete complexity breakdown for a function
 */
export interface ComplexityBreakdown {
  /** Function name */
  functionName: string;

  /** Total cyclomatic complexity */
  complexity: number;

  /** Start line of function */
  startLine: number;

  /** End line of function */
  endLine: number;

  /** All branches contributing to complexity */
  branches: ComplexityBranch[];

  /** Optional code snippet of the function */
  snippet?: CodeSnippet;
}

// ============================================================================
// ENRICHED ISSUE TYPES
// ============================================================================

/**
 * Code context enrichment for an issue
 */
export interface IssueCodeContext {
  /** Code snippet around the issue */
  snippet?: CodeSnippet;

  /** For complexity issues: detailed breakdown */
  complexityBreakdown?: ComplexityBreakdown;
}
