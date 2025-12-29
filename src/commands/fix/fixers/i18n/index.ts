/**
 * @module commands/fix/fixers/i18n
 * @description I18n hardcoded string fixer
 *
 * Detects and provides fixes for hardcoded Russian/English text
 * that should be extracted to i18n translation files.
 *
 * This fixer is marked as 'risky' because:
 * 1. Generated keys may need manual adjustment
 * 2. Translation files must be updated manually
 * 3. Import statements may need to be added
 *
 * @example
 * ```bash
 * # Preview i18n issues
 * krolik fix --category i18n --dry-run
 *
 * # Apply fixes (with review)
 * krolik fix --category i18n
 * ```
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';
import { analyzeI18nIssues } from './analyzer';
import { fixI18nIssue } from './fixer';

/**
 * I18n fixer metadata
 */
export const metadata = createFixerMetadata('i18n', 'I18n Hardcoded Strings', 'i18n', {
  description: 'Extract hardcoded Russian/English text to i18n translation keys',
  difficulty: 'risky',
  cliFlag: '--fix-i18n',
  negateFlag: '--no-i18n',
  tags: ['risky', 'i18n', 'localization', 'russian'],
});

/**
 * I18n fixer implementation
 */
export const i18nFixer: Fixer = {
  metadata,

  analyze(content: string, file: string): QualityIssue[] {
    return analyzeI18nIssues(content, file);
  },

  fix(issue: QualityIssue, content: string): FixOperation | null {
    return fixI18nIssue(issue, content);
  },

  shouldSkip(issue: QualityIssue, _content: string): boolean {
    const file = issue.file;

    // Skip in test files
    if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) {
      return true;
    }

    // Skip in storybook files
    if (file.includes('.stories.')) {
      return true;
    }

    // Skip in configuration files
    if (file.endsWith('.config.ts') || file.endsWith('.config.js')) {
      return true;
    }

    // Skip in i18n translation files
    if (file.includes('/i18n/') || file.includes('/locales/') || file.includes('/translations/')) {
      return true;
    }

    // Skip in node_modules (should never happen, but safety)
    if (file.includes('node_modules')) {
      return true;
    }

    return false;
  },
};

// Re-export for convenience
export { analyzeI18nIssues } from './analyzer';
export { fixI18nIssue, generateI18nImport, hasI18nImport } from './fixer';
