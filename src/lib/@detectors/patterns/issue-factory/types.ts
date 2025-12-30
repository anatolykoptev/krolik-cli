/**
 * @module lib/@detectors/issue-factory/types
 * @description Types for issue factory functions
 */

import type { Severity } from '@/types/severity';

// ============================================================================
// QUALITY ISSUE TYPE (canonical definition)
// ============================================================================

/**
 * Categories of quality issues
 */
export type QualityCategory =
  | 'srp'
  | 'hardcoded'
  | 'complexity'
  | 'mixed-concerns'
  | 'size'
  | 'documentation'
  | 'type-safety'
  | 'circular-dep'
  | 'lint'
  | 'composite'
  | 'agent'
  | 'refine'
  | 'security'
  | 'modernization'
  | 'i18n'
  | 'backwards-compat';

/**
 * A single quality issue found in a file
 *
 * This is the output format for all issue factory functions.
 * Compatible with the QualityIssue type in commands/fix/core/types
 */
export interface QualityIssue {
  /** File path (relative or absolute) */
  file: string;
  /** Line number where the issue was detected */
  line?: number;
  /** Severity level */
  severity: Severity;
  /** Issue category */
  category: QualityCategory;
  /** Human-readable message describing the issue */
  message: string;
  /** Suggestion for how to fix the issue */
  suggestion?: string;
  /** Code snippet for context */
  snippet?: string;
  /** Fixer ID that can auto-fix this issue */
  fixerId?: string;
}

// ============================================================================
// HARDCODED VALUE TYPE
// ============================================================================

/**
 * Types of hardcoded values
 */
export type HardcodedType = 'number' | 'url' | 'color' | 'string' | 'date';

/**
 * Detected hardcoded value
 */
export interface HardcodedValue {
  /** The actual value detected */
  value: string | number;
  /** Type of hardcoded value */
  type: HardcodedType;
  /** Line number */
  line: number;
  /** Surrounding code context */
  context: string;
}

// ============================================================================
// ISSUE FACTORY CONTEXT
// ============================================================================

/**
 * Common context needed by all issue factory functions
 */
export interface IssueFactoryContext {
  /** File path for the issue */
  filepath: string;
  /** File content for snippet extraction */
  content: string;
  /** Precomputed line offsets for fast line number lookup */
  lineOffsets: number[];
  /** Base offset for SWC span adjustment */
  baseOffset: number;
}
