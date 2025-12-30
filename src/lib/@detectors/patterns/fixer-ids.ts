/**
 * @module lib/@detectors/patterns/fixer-ids
 * @description Canonical mapping from detection types to fixer IDs
 *
 * This module provides O(1) lookup tables that map detection types
 * (from AST detectors) to their corresponding fixer IDs (from the
 * fixer registry).
 *
 * Benefits:
 * - Single source of truth for detection-to-fixer mapping
 * - O(1) lookup via ReadonlyMap
 * - Type-safe with explicit typing
 * - Easy to maintain and extend
 *
 * @example
 * ```typescript
 * import { getLintFixerId, getTypeSafetyFixerId } from '@/lib/@detectors';
 *
 * const fixerId = getLintFixerId('console'); // 'console'
 * const tsFixerId = getTypeSafetyFixerId('any-annotation'); // 'any-type'
 * ```
 */

import type {
  LintIssueType,
  ModernizationIssueType,
  ReturnTypeIssueType,
  SecurityIssueType,
  TypeSafetyIssueType,
} from './ast/types';

// ============================================================================
// FIXER ID CONSTANTS
// ============================================================================

/** Fixer ID for return type issues */
export const RETURN_TYPE_FIXER_ID = 'explicit-return-types' as const;

/** Fixer ID for TS directive issues (@ts-expect-error, @ts-nocheck, @ts-expect-error) */
export const TS_DIRECTIVE_FIXER_ID = 'ts-ignore' as const;

/** Fixer ID for complexity issues */
export const COMPLEXITY_FIXER_ID = 'complexity' as const;

/** Fixer ID for long function issues */
export const LONG_FUNCTION_FIXER_ID = 'long-function' as const;

// ============================================================================
// LINT FIXER MAPPINGS
// ============================================================================

/**
 * Maps lint detection types to their fixer IDs
 *
 * Keys: LintIssueType values from detectors
 * Values: metadata.id from registered fixers
 */
export const LINT_FIXER_IDS: ReadonlyMap<LintIssueType, string> = new Map([
  ['console', 'console'],
  ['debugger', 'debugger'],
  ['alert', 'alert'],
  ['eval', 'eval'],
  ['empty-catch', 'empty-catch'],
]);

/**
 * Get fixer ID for a lint issue type
 */
export function getLintFixerId(type: LintIssueType): string | undefined {
  return LINT_FIXER_IDS.get(type);
}

// ============================================================================
// TYPE-SAFETY FIXER MAPPINGS
// ============================================================================

/**
 * Maps type-safety detection types to their fixer IDs
 *
 * Multiple detection types can map to the same fixer
 * (e.g., all `any` variations use 'any-type' fixer)
 */
export const TYPE_SAFETY_FIXER_IDS: ReadonlyMap<TypeSafetyIssueType, string> = new Map([
  ['any-annotation', 'any-type'],
  ['any-assertion', 'any-type'],
  ['any-param', 'any-type'],
  ['any-array', 'any-type'],
  ['non-null', 'non-null-assertion'],
  ['double-assertion', 'double-assertion'],
]);

/**
 * Get fixer ID for a type-safety issue type
 */
export function getTypeSafetyFixerId(type: TypeSafetyIssueType): string | undefined {
  return TYPE_SAFETY_FIXER_IDS.get(type);
}

// ============================================================================
// SECURITY FIXER MAPPINGS
// ============================================================================

/**
 * Maps security detection types to their fixer IDs
 */
export const SECURITY_FIXER_IDS: ReadonlyMap<SecurityIssueType, string> = new Map([
  ['command-injection', 'command-injection'],
  ['path-traversal', 'path-traversal'],
]);

/**
 * Get fixer ID for a security issue type
 */
export function getSecurityFixerId(type: SecurityIssueType): string | undefined {
  return SECURITY_FIXER_IDS.get(type);
}

// ============================================================================
// MODERNIZATION FIXER MAPPINGS
// ============================================================================

/**
 * Maps modernization detection types to their fixer IDs
 */
export const MODERNIZATION_FIXER_IDS: ReadonlyMap<ModernizationIssueType, string> = new Map([
  ['require', 'require'],
]);

/**
 * Get fixer ID for a modernization issue type
 */
export function getModernizationFixerId(type: ModernizationIssueType): string | undefined {
  return MODERNIZATION_FIXER_IDS.get(type);
}

// ============================================================================
// RETURN TYPE FIXER MAPPINGS
// ============================================================================

/**
 * All return type issue types map to the same fixer
 */
const RETURN_TYPE_ISSUE_TYPES: readonly ReturnTypeIssueType[] = [
  'missing-return-type-function',
  'missing-return-type-arrow',
  'missing-return-type-expression',
  'missing-return-type-default',
];

/**
 * Get fixer ID for a return type issue type
 */
export function getReturnTypeFixerId(type: ReturnTypeIssueType): string {
  // All return type issues use the same fixer
  if (RETURN_TYPE_ISSUE_TYPES.includes(type)) {
    return RETURN_TYPE_FIXER_ID;
  }
  return RETURN_TYPE_FIXER_ID;
}

// ============================================================================
// GENERIC FIXER ID LOOKUP
// ============================================================================

/** Detection category for fixer lookup */
export type DetectionCategory =
  | 'lint'
  | 'type-safety'
  | 'security'
  | 'modernization'
  | 'return-type'
  | 'ts-directive'
  | 'complexity';

/**
 * Generic fixer ID lookup by category and type
 *
 * @param category - The detection category
 * @param type - The specific issue type within that category
 * @returns The fixer ID if found, undefined otherwise
 */
export function getFixerId(category: DetectionCategory, type: string): string | undefined {
  switch (category) {
    case 'lint':
      return getLintFixerId(type as LintIssueType);
    case 'type-safety':
      return getTypeSafetyFixerId(type as TypeSafetyIssueType);
    case 'security':
      return getSecurityFixerId(type as SecurityIssueType);
    case 'modernization':
      return getModernizationFixerId(type as ModernizationIssueType);
    case 'return-type':
      return RETURN_TYPE_FIXER_ID;
    case 'ts-directive':
      return TS_DIRECTIVE_FIXER_ID;
    case 'complexity':
      return type === 'long-function' ? LONG_FUNCTION_FIXER_ID : COMPLEXITY_FIXER_ID;
    default:
      return undefined;
  }
}
