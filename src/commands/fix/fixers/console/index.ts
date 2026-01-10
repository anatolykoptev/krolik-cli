/**
 * @module commands/fix/fixers/console
 * @description Console statement fixer
 *
 * Detects and removes console.log/warn/error/info/debug statements.
 *
 * Smart context-aware behavior:
 * - Skips test files (.test.ts, .spec.ts, __tests__)
 * - Skips CLI entry points (/bin/, /cli)
 * - Skips seed files (prisma/seed, database seeds)
 * - Skips logger implementations (logger.ts)
 * - Skips webhook handlers (critical for debugging)
 * - Skips functional console with emoji progress indicators
 */

import { findProjectRoot } from '@/lib/@discovery/project';
import { buildFixContext, isFunctionalConsole, shouldSkipConsoleFix } from '../../context';
import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';
import { analyzeConsole } from './analyzer';
import { fixConsoleIssue } from './fixer';

/**
 * Console fixer metadata
 */
export const metadata = createFixerMetadata('console', 'Console Statements', 'lint', {
  description: 'Remove console.log/warn/error statements',
  difficulty: 'trivial', // Safe to auto-apply - just removes console statements
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

  shouldSkip(issue: QualityIssue, content: string): boolean {
    const file = issue.file;
    const line = issue.line ?? 0;

    // Basic checks first (fast path)
    // Skip in test files
    if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) {
      return true;
    }

    // Skip in CLI entry points (they need console for output)
    if (file.includes('/bin/') || file.includes('/cli')) {
      return true;
    }

    // Smart context-aware checks (slower but more accurate)
    if (content && line > 0) {
      // Find project root and build context
      const projectRoot = findProjectRoot(file);
      const context = buildFixContext(projectRoot, file, content);

      // Use smart detection from context.ts
      if (shouldSkipConsoleFix(context, content, line)) {
        return true;
      }

      // Additional check for functional console patterns
      if (isFunctionalConsole(content, line)) {
        return true;
      }
    }

    return false;
  },
};

// Re-export for convenience
export { analyzeConsole } from './analyzer';
export { fixConsoleIssue } from './fixer';
