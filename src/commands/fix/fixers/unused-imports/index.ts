/**
 * @module commands/fix/fixers/unused-imports
 * @description Unused imports fixer
 *
 * Detects and removes unused imports in TypeScript/JavaScript files.
 * Handles:
 * - Named imports: import { a, b } from 'module'
 * - Default imports: import A from 'module'
 * - Namespace imports: import * as A from 'module'
 * - Mixed imports: import A, { b } from 'module'
 * - Type imports: import type { A } from 'module'
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';
import { analyzeUnusedImports } from './analyzer';
import { fixUnusedImportIssue } from './fixer';

/**
 * Unused imports fixer metadata
 */
export const metadata = createFixerMetadata('unused-imports', 'Unused Imports', 'lint', {
  description: 'Remove unused imports',
  difficulty: 'safe',
  cliFlag: '--fix-imports',
  negateFlag: '--no-imports',
  tags: ['safe', 'imports', 'cleanup'],
});

/**
 * Unused imports fixer implementation
 */
export const unusedImportsFixer: Fixer = {
  metadata,

  analyze(content: string, file: string): QualityIssue[] {
    return analyzeUnusedImports(content, file);
  },

  fix(issue: QualityIssue, content: string): FixOperation | null {
    return fixUnusedImportIssue(issue, content);
  },

  shouldSkip(issue: QualityIssue, _content: string): boolean {
    const file = issue.file;

    // Skip generated files
    if (file.includes('.generated.') || file.includes('__generated__')) {
      return true;
    }

    // Skip declaration files
    if (file.endsWith('.d.ts')) {
      return true;
    }

    return false;
  },
};

// Re-export for convenience
export { analyzeUnusedImports } from './analyzer';
export { fixUnusedImportIssue } from './fixer';
