/**
 * @module commands/fix/fixers/i18n
 * @description I18n hardcoded string fixer with catalog-first approach
 *
 * Implements Google/Airbnb-style i18n workflow:
 * 1. onStart: Load existing translations from locale files
 * 2. fix: Reuse existing keys or generate new ones
 * 3. onComplete: Flush new translations to locale files
 *
 * Architecture (refactored):
 * - types.ts: Type definitions
 * - constants.ts: Configuration constants
 * - detector.ts: Line-by-line Russian text detection
 * - catalog.ts: Translation catalog management
 * - replacer.ts: Line-by-line text replacement
 * - fixer.ts: Fix operation generation with catalog integration
 * - analyzer.ts: Integration with audit system
 *
 * @example
 * ```bash
 * # Preview i18n issues
 * krolik fix --category i18n --dry-run
 *
 * # Apply fixes (with review)
 * krolik fix --category i18n --all
 * ```
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixerContext, FixOperation, QualityIssue } from '../../core/types';
import { analyzeI18nIssues } from './analyzer';
import {
  addMissingImports,
  fixI18nIssue,
  flushCatalog,
  getFixStats,
  initializeCatalog,
} from './fixer';

// ============================================================================
// FIXER METADATA
// ============================================================================

/**
 * I18n fixer metadata
 */
export const metadata = createFixerMetadata('i18n', 'I18n Hardcoded Strings', 'i18n', {
  description: 'Extract hardcoded Russian text to i18n translation keys',
  difficulty: 'risky', // TODO: not production-ready
  cliFlag: '--fix-i18n',
  negateFlag: '--no-i18n',
  tags: ['i18n', 'localization', 'russian', 'catalog-first'],
});

// ============================================================================
// FIXER IMPLEMENTATION
// ============================================================================

/**
 * I18n fixer implementation with lifecycle hooks
 */
export const i18nFixer: Fixer = {
  metadata,

  /**
   * Analyze content for hardcoded strings
   */
  analyze(content: string, file: string): QualityIssue[] {
    return analyzeI18nIssues(content, file);
  },

  /**
   * Generate fix operation using catalog-first approach
   */
  fix(issue: QualityIssue, content: string): FixOperation | null {
    return fixI18nIssue(issue, content);
  },

  /**
   * Skip certain files from i18n processing
   */
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

  /**
   * Load locale catalog before fixing
   */
  async onStart(context: FixerContext): Promise<void> {
    await initializeCatalog(context.projectRoot);
  },

  /**
   * Flush new translations to locale files and add missing imports
   */
  async onComplete(context: FixerContext): Promise<void> {
    // Skip flush on dry run
    if (context.dryRun) {
      const stats = getFixStats();
      if (stats.newKeys > 0) {
        // eslint-disable-next-line no-console
        console.log(`  → Would add ${stats.newKeys} new translation keys`);
      }
      if (stats.existingKeys > 0) {
        // eslint-disable-next-line no-console
        console.log(`  → Would reuse ${stats.existingKeys} existing keys`);
      }
      return;
    }

    // Add missing imports to fixed files
    const importsAdded = addMissingImports();
    if (importsAdded > 0) {
      // eslint-disable-next-line no-console
      console.log(`  ✓ Added t() import to ${importsAdded} file(s)`);
    }

    // Flush translations to locale files
    const result = await flushCatalog();
    if (result.newKeys > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `  ✓ Added ${result.newKeys} new translations to ${result.filesUpdated} locale file(s)`,
      );
    }
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export fixer utilities
export {
  analyzeI18nIssues,
  clearI18nCache,
  isCachePopulated,
  scanProjectI18n,
} from './analyzer';
// Re-export catalog
export {
  addEntry,
  convertToIcu,
  createCatalog,
  formatAsJson,
  formatAsTypeScript,
  handleCollision,
  loadExistingCatalog,
  mergeCatalogs,
} from './catalog';
// Re-export constants
export {
  ATTRIBUTE_CATEGORIES,
  DEFAULT_DETECTION_CONFIG,
  DEFAULT_EXTRACTION_CONFIG,
  DEFAULT_REPLACEMENT_CONFIG,
  JSX_TEXT_CATEGORIES,
  RUSSIAN_CHAR_PATTERN,
  SKIP_PATTERNS,
} from './constants';
export {
  addMissingImports,
  fixI18nIssue,
  flushCatalog,
  generateI18nImport,
  getFilesNeedingImport,
  getFixStats,
  hasI18nImport,
  initializeCatalog,
} from './fixer';
// Re-export replacer
export { replaceInFile } from './replacer';
// Re-export types
export type {
  CollisionStrategy,
  Detection,
  DetectionConfig,
  DetectionContext,
  ExtractionConfig,
  Replacement,
  ReplacementConfig,
  SkippedReplacement,
  StringCategory,
  TransformResult,
  TranslationCatalog,
  TranslationEntry,
} from './types';
