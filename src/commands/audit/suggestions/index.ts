/**
 * @module commands/audit/suggestions
 * @description Context-aware code suggestions for audit issues
 *
 * Provides AST-based suggestion generation with before/after diffs
 * and confidence scoring for code quality improvements.
 *
 * ## Key Features
 *
 * - **Type Inference**: Infers types from usage patterns for any -> unknown conversions
 * - **Before/After Diffs**: Shows exact code changes with reasoning
 * - **Confidence Scoring**: 0-100 confidence for each suggestion
 * - **Fast AST Parsing**: Uses SWC for 10-50x faster analysis
 *
 * ## Usage
 *
 * @example
 * ```typescript
 * import { generateSuggestion, Suggestion } from './suggestions';
 *
 * // Generate suggestion for a single issue
 * const suggestion = generateSuggestion(issue, content, filePath);
 * if (suggestion) {
 *   console.log(`Before: ${suggestion.before}`);
 *   console.log(`After: ${suggestion.after}`);
 *   console.log(`Confidence: ${suggestion.confidence}%`);
 *   console.log(`Reason: ${suggestion.reasoning}`);
 * }
 * ```
 *
 * @example
 * ```typescript
 * import { generateSuggestions } from './suggestions';
 *
 * // Generate suggestions for multiple issues
 * const suggestions = generateSuggestions(issues);
 * for (const [key, suggestion] of suggestions) {
 *   console.log(`${key}: ${suggestion.confidence}% confidence`);
 * }
 * ```
 *
 * ## Supported Categories
 *
 * | Category | Suggestion Type | Confidence |
 * |----------|-----------------|------------|
 * | type-safety | any -> unknown/inferred | 75-100% |
 * | lint | console/debugger removal | 90-100% |
 * | complexity | Refactoring hints | 50-75% |
 *
 * ## Architecture
 *
 * ```
 * suggestions/
 * ├── types.ts           # Suggestion, SuggestionContext types
 * ├── type-inference.ts  # Type inference from usage patterns
 * ├── generator.ts       # Main suggestion generation
 * └── index.ts           # Module barrel export
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  ComplexitySuggestionDetails,
  ConfidenceLevel,
  LintSuggestionDetails,
  Suggestion,
  SuggestionCategory,
  SuggestionConfig,
  SuggestionContext,
  TypeContext,
  TypeEvidence,
  TypeInferenceResult,
  TypeInferenceSource,
  TypeSafetySuggestionDetails,
} from './types';

export { DEFAULT_SUGGESTION_CONFIG } from './types';

// ============================================================================
// GENERATOR
// ============================================================================

export {
  formatConfidence,
  generateSuggestion,
  generateSuggestions,
  isAutoApplicable,
  isHighConfidence,
} from './generator';

// ============================================================================
// CATEGORY-SPECIFIC GENERATORS
// ============================================================================

export { generateComplexitySuggestion } from './complexity-suggestions';
export { generateLintSuggestion } from './lint-suggestions';
export type { TypeSafetySuggestion } from './type-safety-suggestions';
export {
  generateTypeContextXmlForIssue,
  generateTypeSafetySuggestion,
} from './type-safety-suggestions';

// ============================================================================
// TYPE INFERENCE
// ============================================================================

// Re-export shared utilities
export { getConfidenceLabel } from '../utils';
export {
  buildTypeContext,
  generateTypeContextXml,
  hasAnyType,
  inferAndGenerateXml,
  inferTypeFromUsage,
  replaceAnyType,
} from './type-inference';

export type { EnhancedTypeInferenceResult } from './usage-analysis';
