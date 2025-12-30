/**
 * @module commands/fix/fixers/eval
 * @description Eval fixer - detects and fixes eval() security risks
 *
 * Detects:
 * - eval() calls
 * - new Function() constructor
 *
 * Fixes:
 * - Converts eval(jsonString) to JSON.parse(jsonString) when safe
 * - Adds TODO comment for complex cases
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';
import { analyzeEval } from './analyzer';
import { fixEvalIssue } from './fixer';

/**
 * Eval fixer metadata
 */
export const metadata = createFixerMetadata('eval', 'Eval Security', 'type-safety', {
  description: 'Detect and fix eval() security risks',
  difficulty: 'risky', // TODO: not production-ready
  cliFlag: '--fix-eval',
  negateFlag: '--no-eval',
  tags: ['security', 'safe', 'eval'],
});

/**
 * Eval fixer implementation
 */
export const evalFixer: Fixer = {
  metadata,

  analyze(content: string, file: string): QualityIssue[] {
    return analyzeEval(content, file);
  },

  fix(issue: QualityIssue, content: string): FixOperation | null {
    return fixEvalIssue(issue, content);
  },

  shouldSkip(issue: QualityIssue, _content: string): boolean {
    const file = issue.file;

    // Skip in test files - they might test eval behavior
    if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) {
      return true;
    }

    // Skip in bundler/build configs - they might legitimately need eval
    if (file.includes('webpack') || file.includes('rollup') || file.includes('vite.config')) {
      return true;
    }

    return false;
  },
};

// Re-export for convenience
export { analyzeEval } from './analyzer';
export { fixEvalIssue } from './fixer';
