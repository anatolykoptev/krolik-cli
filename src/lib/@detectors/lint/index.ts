/**
 * @module lib/@detectors/lint
 * @description Unified lint and type-safety AST detectors
 *
 * This module consolidates two detector types:
 * 1. Lint detectors: console, debugger, alert, eval, empty-catch
 * 2. Type-safety detectors: any, as any, double assertions, non-null assertions
 *
 * Both use SWC AST for fast, accurate detection.
 */

// ============================================================================
// LINT DETECTORS (console, debugger, alert, eval, empty-catch)
// ============================================================================

export {
  detectAlert,
  detectConsole,
  detectDebugger,
  detectEmptyCatch,
  detectEval,
  detectLintIssue,
} from './lint-detector';

// ============================================================================
// TYPE-SAFETY DETECTORS (any, as any, double assertions, non-null)
// ============================================================================

export {
  detectAnyAnnotation,
  detectAnyAssertion,
  detectDoubleAssertion,
  detectNonNullAssertion,
  detectTypeSafetyIssue,
  isAnyType,
  isUnknownType,
} from './type-safety-detector';
