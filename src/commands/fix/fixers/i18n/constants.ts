/**
 * @module commands/fix/fixers/i18n/constants
 * @description Configuration constants for the i18n fixer.
 */

import type { DetectionConfig, ExtractionConfig, ReplacementConfig, StringCategory } from './types';

/** Default configuration for detecting Russian text in source files. */
export const DEFAULT_DETECTION_CONFIG: Readonly<DetectionConfig> = {
  minLength: 2,
  maxLength: 500,
  minConfidence: 0.7,
  includeJsxText: true,
  includeJsxAttributes: true,
  includeStringLiterals: true,
  includeTemplateLiterals: true,
  skipPatterns: [],
} as const;

/** Default configuration for extracting translations to catalog. */
export const DEFAULT_EXTRACTION_CONFIG: Readonly<ExtractionConfig> = {
  projectId: 'app',
  locale: 'ru',
  collisionStrategy: 'suffix',
} as const;

/** Default configuration for replacing Russian text with t() calls. */
export const DEFAULT_REPLACEMENT_CONFIG: Readonly<ReplacementConfig> = {
  functionName: 't',
  importStatement: "import { useTranslation } from 'next-i18next';",
  addImport: true,
  dryRun: false,
} as const;

/** Regex pattern for detecting Cyrillic (Russian) characters. */
export const RUSSIAN_CHAR_PATTERN = /[\u0400-\u04FF]/u;

/** Patterns for technical strings that should be skipped during detection. */
export const SKIP_PATTERNS: readonly RegExp[] = [
  /^https?:\/\//, // URLs
  /^[a-zA-Z0-9_-]+$/, // Pure alphanumeric identifiers
  /^\d+$/, // Pure numbers
  /^[A-Z][A-Z0-9_]+$/, // Constants (UPPER_SNAKE_CASE)
  /^[a-z]+\.[a-z.]+$/, // Dot notation keys (e.g., 'common.button')
  /^\s*$/, // Whitespace only
  /^[\s\n\r\t]+$/, // Line breaks only
  /^[.,;:!?()-]+$/, // Punctuation only
] as const;

/** Maps JSX attribute names to string categories for key naming. */
export const ATTRIBUTE_CATEGORIES: Readonly<Record<string, StringCategory>> = {
  placeholder: 'placeholder',
  title: 'title',
  heading: 'title',
  description: 'description',
  alt: 'description',
  label: 'ui-label',
  'aria-label': 'other',
  'aria-labelledby': 'other',
  'aria-describedby': 'other',
  tooltip: 'tooltip',
  message: 'message',
  successMessage: 'toast',
  errorMessage: 'message',
  validationMessage: 'validation',
  error: 'message',
  helperText: 'description',
} as const;

/** Patterns for categorizing JSX text content. Tuple: [pattern, category]. */
export const JSX_TEXT_CATEGORIES: readonly [RegExp, StringCategory][] = [
  [/ошибк|неверн|недопустим|некорректн/i, 'message'],
  [/обязательн|заполните|введите/i, 'validation'],
  [/уведомлен|сообщен|успешно|внимание/i, 'toast'],
  [/описание|подробн|информац/i, 'description'],
  [/заголовок|название/i, 'title'],
  [/подсказк/i, 'tooltip'],
] as const;
