/**
 * @module commands/fix/fixers/equality
 * @description Strict equality fixer (AST-based)
 *
 * Detects and replaces loose equality operators (== and !=)
 * with strict equality operators (=== and !==).
 * Uses ts-morph AST for 100% accurate detection and fixing.
 *
 * Benefits over regex-based approach:
 * - Correctly skips operators inside strings and comments
 * - Exact byte positions for precise replacement
 * - No false positives from regex pattern matching
 *
 * @example
 * // Before
 * if (x == null) { ... }
 * if (x != undefined) { ... }
 *
 * // After
 * if (x === null) { ... }
 * if (x !== undefined) { ... }
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';
import { analyzeEqualityAST } from './ast-analyzer';
import { fixEqualityIssueAST } from './ast-fixer';

/**
 * Equality fixer metadata
 */
export const metadata = createFixerMetadata('equality', 'Strict Equality', 'type-safety', {
  description: 'Replace == with === and != with !==',
  difficulty: 'safe', // Now safe with ts-morph AST-based implementation
  cliFlag: '--fix-equality',
  negateFlag: '--no-equality',
  tags: ['safe', 'type-safety', 'eslint'],
});

/**
 * Equality fixer implementation
 */
export const equalityFixer: Fixer = {
  metadata,

  analyze(content: string, file: string): QualityIssue[] {
    return analyzeEqualityAST(content, file);
  },

  fix(issue: QualityIssue, content: string): FixOperation | null {
    return fixEqualityIssueAST(issue, content);
  },

  shouldSkip(issue: QualityIssue, _content: string): boolean {
    const file = issue.file;

    // Skip in test files (intentional loose equality tests)
    if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) {
      return true;
    }

    return false;
  },
};

// Legacy exports for backwards compatibility
export { analyzeEquality } from './analyzer';
// Re-export AST-based functions as primary API
export { analyzeEqualityAST } from './ast-analyzer';
export { fixAllEqualityInFile, fixEqualityIssueAST } from './ast-fixer';
export { fixEqualityIssue } from './fixer';
