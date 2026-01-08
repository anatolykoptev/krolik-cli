/**
 * @module commands/fix/fixers/eval
 * @description Eval fixer (AST-based) - detects and fixes eval() security risks
 *
 * Uses ts-morph AST for 100% accurate detection of:
 * - eval() calls
 * - new Function() constructor
 *
 * Fixes:
 * - Converts eval(jsonVar) to JSON.parse(jsonVar) when safe
 * - Adds TODO comment for complex cases
 *
 * Benefits over regex-based approach:
 * - Correctly skips eval inside strings and comments
 * - Correctly identifies actual function calls vs identifiers
 * - More reliable variable name detection for JSON.parse conversion
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';
import { analyzeEvalAST } from './ast-analyzer';
import { fixEvalIssueAST } from './ast-fixer';

/**
 * Eval fixer metadata
 */
export const metadata = createFixerMetadata('eval', 'Eval Security', 'type-safety', {
  description: 'Detect and fix eval() security risks',
  difficulty: 'safe', // Now safe with ts-morph AST-based implementation
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
    return analyzeEvalAST(content, file);
  },

  fix(issue: QualityIssue, content: string): FixOperation | null {
    return fixEvalIssueAST(issue, content);
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

// Legacy exports for backwards compatibility
export { analyzeEval } from './analyzer';
// Re-export AST-based functions as primary API
export { analyzeEvalAST } from './ast-analyzer';
export { fixEvalIssueAST } from './ast-fixer';
export { fixEvalIssue } from './fixer';
