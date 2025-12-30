/**
 * @module lib/@detectors/issue-factory/complexity
 * @description Factory functions for creating complexity quality issues
 */

import { getSnippet } from '@/lib/@ast/swc';
import { COMPLEXITY_FIXER_ID, LONG_FUNCTION_FIXER_ID } from '../fixer-ids';
import type { QualityIssue } from './types';

// ============================================================================
// COMPLEXITY ISSUE FACTORY
// ============================================================================

/**
 * Context for complexity issue creation
 */
export interface ComplexityIssueContext {
  /** File path */
  filepath: string;
  /** File content */
  content: string;
  /** Line offsets for position mapping */
  lineOffsets: number[];
  /** Maximum allowed complexity */
  maxComplexity: number;
  /** Maximum allowed function lines */
  maxFunctionLines: number;
}

/**
 * Function info for complexity issue creation
 */
export interface FunctionComplexityInfo {
  /** Function name */
  name: string;
  /** Start line */
  startLine: number;
  /** Start offset in content */
  startOffset: number;
  /** Cyclomatic complexity */
  complexity: number;
  /** Number of lines */
  lines: number;
}

/**
 * Create a QualityIssue for high cyclomatic complexity
 *
 * @param func - Function info with complexity metrics
 * @param ctx - Context with thresholds and file info
 * @returns QualityIssue
 */
export function createHighComplexityIssue(
  func: FunctionComplexityInfo,
  ctx: ComplexityIssueContext,
): QualityIssue {
  const snippet = getSnippet(ctx.content, func.startOffset, ctx.lineOffsets);

  return {
    file: ctx.filepath,
    line: func.startLine,
    severity: 'warning',
    category: 'complexity',
    message: `Function "${func.name}" has high cyclomatic complexity (${func.complexity})`,
    suggestion: `Consider refactoring to reduce complexity below ${ctx.maxComplexity}`,
    snippet,
    fixerId: COMPLEXITY_FIXER_ID,
  };
}

/**
 * Create a QualityIssue for long function
 *
 * @param func - Function info with line count
 * @param ctx - Context with thresholds and file info
 * @returns QualityIssue
 */
export function createLongFunctionIssue(
  func: FunctionComplexityInfo,
  ctx: ComplexityIssueContext,
): QualityIssue {
  const snippet = getSnippet(ctx.content, func.startOffset, ctx.lineOffsets);

  return {
    file: ctx.filepath,
    line: func.startLine,
    severity: 'warning',
    category: 'complexity',
    message: `Function "${func.name}" is too long (${func.lines} lines)`,
    suggestion: `Consider splitting into smaller functions (max ${ctx.maxFunctionLines} lines)`,
    snippet,
    fixerId: LONG_FUNCTION_FIXER_ID,
  };
}

/**
 * Create complexity issues for a function that exceeds thresholds
 *
 * @param func - Function info with metrics
 * @param ctx - Context with thresholds
 * @returns Array of QualityIssue (0-2 issues per function)
 */
export function createComplexityIssues(
  func: FunctionComplexityInfo,
  ctx: ComplexityIssueContext,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (func.complexity > ctx.maxComplexity) {
    issues.push(createHighComplexityIssue(func, ctx));
  }

  if (func.lines > ctx.maxFunctionLines) {
    issues.push(createLongFunctionIssue(func, ctx));
  }

  return issues;
}
