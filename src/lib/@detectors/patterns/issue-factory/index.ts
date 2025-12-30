/**
 * @module lib/@detectors/issue-factory
 * @description Factory functions for creating QualityIssue objects from detections
 *
 * This module provides a clean separation between:
 * - AST detectors (pure detection, return detection objects)
 * - Issue factory (converts detections to QualityIssue with messages)
 *
 * Benefits:
 * - Single source of truth for issue message templates
 * - Consistent issue formatting across all detectors
 * - Easy to maintain and extend
 * - Testable in isolation
 *
 * @example
 * ```typescript
 * import { createLintIssue, createTypeSafetyIssues } from '@/lib/@detectors/issue-factory';
 *
 * const ctx = { filepath, content, lineOffsets, baseOffset };
 *
 * const lintIssue = createLintIssue(lintDetection, ctx);
 * const typeIssues = createTypeSafetyIssues(typeDetections, ctx);
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type {
  HardcodedType,
  HardcodedValue,
  IssueFactoryContext,
  QualityCategory,
  QualityIssue,
} from './types';

// ============================================================================
// LINT ISSUES
// ============================================================================

export {
  createLintIssue,
  createLintIssues,
} from './lint';

// ============================================================================
// TYPE-SAFETY ISSUES
// ============================================================================

export {
  createReturnTypeIssue,
  createReturnTypeIssues,
  createTsDirectiveIssue,
  createTypeSafetyIssue,
  createTypeSafetyIssues,
  type TsDirectiveType,
} from './type-safety';

// ============================================================================
// SECURITY ISSUES
// ============================================================================

export {
  createSecurityIssue,
  createSecurityIssues,
} from './security';

// ============================================================================
// MODERNIZATION ISSUES
// ============================================================================

export {
  createModernizationIssue,
  createModernizationIssues,
} from './modernization';

// ============================================================================
// HARDCODED VALUES
// ============================================================================

export {
  createHardcodedValue,
  createHardcodedValues,
  getHardcodedSuggestion,
} from './hardcoded';

// ============================================================================
// COMPLEXITY ISSUES
// ============================================================================

export type {
  ComplexityIssueContext,
  FunctionComplexityInfo,
} from './complexity';

export {
  createComplexityIssues,
  createHighComplexityIssue,
  createLongFunctionIssue,
} from './complexity';
