/**
 * @module commands/fix/fixers/console
 * @description Console statement fixer
 *
 * Detects and removes console.log/warn/error/info/debug statements.
 * Smart behavior: skips CLI output files and test files.
 */

import type { Fixer, QualityIssue, FixOperation } from '../../core/types';
import { createFixerMetadata } from '../../core/registry';
import { analyzeConsole } from './analyzer';
import { fixConsoleIssue } from './fixer';

/**
 * Console fixer metadata
 */
export const metadata = createFixerMetadata('console', 'Console Statements', 'lint', {
  description: 'Remove console.log/warn/error statements',
  difficulty: 'trivial',
  cliFlag: '--fix-console',
  negateFlag: '--no-console',
  tags: ['trivial', 'safe-to-autofix', 'debugging'],
});

/**
 * Console fixer implementation
 */
export const consoleFixer: Fixer = {
  metadata,

  analyze(content: string, file: string): QualityIssue[] {
    return analyzeConsole(content, file);
  },

  fix(issue: QualityIssue, content: string): FixOperation | null {
    return fixConsoleIssue(issue, content);
  },

  shouldSkip(issue: QualityIssue, _content: string): boolean {
    const file = issue.file;

    // Skip in test files
    if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) {
      return true;
    }

    // Skip in CLI entry points (they need console for output)
    if (file.includes('/bin/') || file.includes('/cli')) {
      return true;
    }

    return false;
  },
};

// Re-export for convenience
export { analyzeConsole } from './analyzer';
export { fixConsoleIssue } from './fixer';
