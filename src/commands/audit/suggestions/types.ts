/**
 * @module commands/audit/suggestions/types
 * @description Types for context-aware code suggestions
 *
 * Supports AST-based suggestion generation with before/after diffs
 * and confidence scoring.
 */

import type { QualityIssue } from '../../fix/core';

// ============================================================================
// SUGGESTION TYPES
// ============================================================================

/**
 * Confidence level for a suggestion
 *
 * - 100: Guaranteed safe (e.g., any -> unknown)
 * - 75-99: High confidence from type inference
 * - 50-74: Medium confidence, requires review
 * - 0-49: Low confidence, may not be accurate
 */
export type ConfidenceLevel = number;

/**
 * A code suggestion with before/after and reasoning
 *
 * @example
 * ```typescript
 * const suggestion: Suggestion = {
 *   before: 'const handler: any = (req) => ...',
 *   after: 'const handler: unknown = (req) => ...',
 *   reasoning: 'Safe replacement: unknown requires type guards',
 *   confidence: 100,
 * };
 * ```
 */
export interface Suggestion {
  /** Original code snippet */
  before: string;
  /** Suggested replacement code */
  after: string;
  /** Explanation of why this change is recommended */
  reasoning: string;
  /** Confidence score 0-100 */
  confidence: ConfidenceLevel;
  /** Type context with inference details (for type-safety issues) */
  typeContext?: TypeContext | undefined;
}

/**
 * Context for generating suggestions
 *
 * Provides all necessary information about the code context
 * to generate accurate suggestions.
 */
export interface SuggestionContext {
  /** The quality issue being addressed */
  issue: QualityIssue;
  /** Full file content */
  content: string;
  /** File path for AST parsing */
  filePath: string;
  /** Line content where issue was detected */
  lineContent: string;
  /** Lines before the issue (for context) */
  linesBefore: string[];
  /** Lines after the issue (for context) */
  linesAfter: string[];
}

/**
 * Type inference result from usage analysis
 */
export interface TypeInferenceResult {
  /** Inferred type string (e.g., 'string', 'RequestHandler<Params>') */
  inferredType: string;
  /** Confidence in the inference */
  confidence: ConfidenceLevel;
  /** How the type was inferred */
  source: TypeInferenceSource;
  /** Additional context about the inference */
  details?: string;
}

/**
 * How a type was inferred
 */
export type TypeInferenceSource =
  | 'fallback' // Default fallback (e.g., any -> unknown)
  | 'usage' // Inferred from how the value is used
  | 'assignment' // Inferred from assigned values
  | 'return' // Inferred from return statements
  | 'parameter' // Inferred from function parameter usage
  | 'property-access'; // Inferred from property access patterns

/**
 * Suggestion category for different issue types
 */
export type SuggestionCategory =
  | 'type-safety' // any -> unknown, missing types
  | 'lint' // console.log, debugger removal
  | 'complexity' // Extract function hints
  | 'hardcoded' // Extract to constants
  | 'security'; // Path traversal, injection fixes

/**
 * Configuration for suggestion generation
 */
export interface SuggestionConfig {
  /** Maximum lines of context to analyze */
  maxContextLines: number;
  /** Minimum confidence threshold to include suggestion */
  minConfidence: ConfidenceLevel;
  /** Categories to generate suggestions for */
  enabledCategories: SuggestionCategory[];
}

/**
 * Default suggestion configuration
 */
export const DEFAULT_SUGGESTION_CONFIG: SuggestionConfig = {
  maxContextLines: 10,
  minConfidence: 50,
  enabledCategories: ['type-safety', 'lint', 'complexity'],
};

// ============================================================================
// CATEGORY-SPECIFIC TYPES
// ============================================================================

/**
 * Type safety suggestion details
 */
export interface TypeSafetySuggestionDetails {
  /** Original type (e.g., 'any') */
  originalType: string;
  /** Suggested replacement type */
  suggestedType: string;
  /** Type inference result if available */
  inference?: TypeInferenceResult;
}

/**
 * Evidence for type inference
 * Records specific usage patterns that support the inferred type
 */
export interface TypeEvidence {
  /** Type of evidence (e.g., 'method-call', 'property-access', 'argument') */
  type:
    | 'method-call'
    | 'property-access'
    | 'for-of'
    | 'spread'
    | 'indexing'
    | 'argument'
    | 'return';
  /** Description of the usage (e.g., 'Object.keys(data) called') */
  description: string;
  /** Line number where the usage was found (undefined if unknown) */
  line?: number | undefined;
}

/**
 * Enhanced type context for XML output
 * Provides detailed context for any type issues
 */
export interface TypeContext {
  /** Original code line with the `any` type */
  current: string;
  /** Inferred type suggestion */
  inferredType: string;
  /** Confidence percentage (0-100) */
  confidence: number;
  /** List of evidence supporting the inference */
  evidence: TypeEvidence[];
  /** Suggested fix with the inferred type applied */
  suggestedFix: string;
}

/**
 * Lint fix suggestion details
 */
export interface LintSuggestionDetails {
  /** Type of lint issue */
  lintType: 'console-log' | 'debugger' | 'alert' | 'eval';
  /** Whether removal is safe */
  safeToRemove: boolean;
  /** Reason for removal */
  removalReason: string;
}

/**
 * Complexity suggestion details
 */
export interface ComplexitySuggestionDetails {
  /** Current complexity score */
  currentComplexity: number;
  /** Suggested function name for extraction */
  suggestedFunctionName?: string;
  /** Lines to extract */
  extractRange?: { start: number; end: number };
}
