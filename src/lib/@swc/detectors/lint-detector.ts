/**
 * @module lib/@swc/detectors/lint-detector
 * @deprecated Use '@/lib/@patterns/lint/detector' instead.
 *
 * This module re-exports all lint detection functions from the canonical location.
 * The implementation has been consolidated to avoid code duplication.
 */
export {
  detectAlert,
  detectConsole,
  detectDebugger,
  detectEmptyCatch,
  detectEval,
  detectLintIssue,
} from '@/lib/@patterns/lint/detector';
