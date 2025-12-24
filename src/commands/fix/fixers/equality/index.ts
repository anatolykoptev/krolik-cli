/**
 * @module commands/fix/fixers/equality
 * @description Strict equality fixer
 *
 * Detects and replaces loose equality operators (== and !=)
 * with strict equality operators (=== and !==).
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
import { analyzeEquality } from './analyzer';
import { fixEqualityIssue } from './fixer';

/**
 * Equality fixer metadata
 */
export const metadata = createFixerMetadata('equality', 'Strict Equality', 'type-safety', {
  description: 'Replace == with === and != with !==',
  difficulty: 'safe',
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
    return analyzeEquality(content, file);
  },

  fix(issue: QualityIssue, content: string): FixOperation | null {
    return fixEqualityIssue(issue, content);
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

// Re-export for convenience
export { analyzeEquality } from './analyzer';
export { fixEqualityIssue } from './fixer';
