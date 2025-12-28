/**
 * @module commands/fix/strategies/complexity
 * @description AST-based fix strategies for complexity issues
 *
 * Handles:
 * - Deep nesting (early returns)
 * - High cyclomatic complexity (if-chain to map, refactorings)
 * - Long functions (block extraction)
 */

import { matchNumberInRange } from '../../core';
import type { FixOperation, FixStrategy, QualityIssue } from '../../types';
import { validateAndFormat } from '../shared';
import { generateComplexityFix } from './complexity-fix';
import { generateLongFunctionFix } from './long-function-fix';
import { generateNestingFix } from './nesting-fix';
import { COMPLEXITY_RANGE, LONG_FUNCTION_RANGE, PATTERNS } from './patterns';

// ============================================================================
// STRATEGY
// ============================================================================

/**
 * Complexity fix strategy using AST transformations
 *
 * Features:
 * - Validates output syntax before applying
 * - Formats with Prettier for consistency
 * - Fails safely on invalid transformations
 */
export const complexityStrategy: FixStrategy = {
  categories: ['complexity'],

  canFix(issue: QualityIssue, _content: string): boolean {
    const { message } = issue;

    // Nesting issues - always fixable
    if (PATTERNS.NESTING.test(message)) {
      return true;
    }

    // Complexity issues - check if within range
    if (matchNumberInRange(message, PATTERNS.COMPLEXITY, COMPLEXITY_RANGE)) {
      return true;
    }

    // Long function issues - check if within range
    if (matchNumberInRange(message, PATTERNS.LONG_FUNCTION, LONG_FUNCTION_RANGE)) {
      return true;
    }

    return false;
  },

  async generateFix(issue: QualityIssue, content: string): Promise<FixOperation | null> {
    const { message, line, file } = issue;

    if (!file) return null;

    try {
      const result = generateFixOperation(message, content, file, line);

      if (!result || !result.newCode) return null;

      // Validate syntax and format with Prettier
      const validated = await validateAndFormat(result.newCode, file);

      if (!validated) return null;

      return {
        ...result,
        newCode: validated,
      };
    } catch {
      // AST transformation failed - skip this fix
      return null;
    }
  },
};

// ============================================================================
// FIX ROUTING
// ============================================================================

/**
 * Route to appropriate fix generator based on message pattern
 */
function generateFixOperation(
  message: string,
  content: string,
  file: string,
  line?: number,
): FixOperation | null {
  // Nesting issues -> early returns
  if (PATTERNS.NESTING.test(message)) {
    return generateNestingFix(content, file, line);
  }

  // Complexity issues -> multiple strategies
  if (PATTERNS.COMPLEXITY.test(message)) {
    return generateComplexityFix(content, file, line);
  }

  // Long functions -> block extraction
  if (PATTERNS.LONG_FUNCTION.test(message)) {
    return generateLongFunctionFix(content, file, line);
  }

  return null;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export { generateComplexityFix } from './complexity-fix';
export { findExtractionRange, findFunctionEnd, generateFunctionName } from './helpers';
export { generateLongFunctionFix } from './long-function-fix';
export { generateNestingFix } from './nesting-fix';
export { COMPLEXITY_RANGE, LONG_FUNCTION_RANGE, PATTERNS } from './patterns';
