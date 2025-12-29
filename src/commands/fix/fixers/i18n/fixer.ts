/**
 * @module commands/fix/fixers/i18n/fixer
 * @description Fixes hardcoded i18n strings by extracting them to translation keys
 *
 * This fixer generates code transformations to replace hardcoded Russian/English
 * text with i18n function calls (t('key')).
 *
 * Note: This fixer is marked as 'risky' because:
 * 1. It requires adding translation files manually
 * 2. The generated keys may need adjustment
 * 3. Import statements may need to be added
 */

import { detectNamespace, textToKey } from '../../../refactor/analyzers/i18n/key-generator';
import type { FixOperation, QualityIssue } from '../../core/types';
import { createReplaceLine, getLineContext } from '../../core/utils';

/**
 * Generate an i18n key from the text value and file path
 * Uses the shared key-generator for consistent transliteration and namespace detection
 */
function generateI18nKeySimple(text: string, file: string): string {
  // Get namespace from file path using project-aware detection
  const namespace = detectNamespace(file);

  // Convert text to key using proper transliteration and stop-word filtering
  const keyPart = textToKey(text);

  return `${namespace}.${keyPart}`;
}

/**
 * Determine the replacement template based on context
 */
function getReplacementTemplate(
  snippet: string | undefined,
  value: string,
): { prefix: string; suffix: string } {
  if (!snippet) {
    return { prefix: "t('", suffix: "')" };
  }

  // JSX text: <span>Текст</span> → <span>{t('key')}</span>
  if (snippet === value) {
    return { prefix: "{t('", suffix: "')}" };
  }

  // JSX attribute: placeholder="Текст" → placeholder={t('key')}
  const attrMatch = snippet.match(/^(\w+)="[^"]*"$/);
  if (attrMatch) {
    return { prefix: `${attrMatch[1]}={t('`, suffix: "')}]" };
  }

  // Default: just use t()
  return { prefix: "t('", suffix: "')" };
}

/**
 * Fix i18n issue by replacing hardcoded text with t() call
 */
export function fixI18nIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const ctx = getLineContext(content, issue.line);
  if (!ctx) return null;

  // Extract the text value from the message
  const textMatch = issue.message.match(/: "([^"]+)"$/);
  if (!textMatch?.[1]) return null;

  const text = textMatch[1].replace(/\.\.\.$/, ''); // Remove truncation
  const key = generateI18nKeySimple(text, issue.file);

  // Determine what to replace
  const { prefix, suffix } = getReplacementTemplate(issue.snippet, text);

  // Build replacement
  const replacement = `${prefix}${key}${suffix}`;

  // Find the text in the line and replace
  let newLine = ctx.line;

  // Try different replacement strategies

  // 1. Direct text in JSX: >Текст< → >{t('key')}<
  if (ctx.line.includes(`>${text}<`)) {
    newLine = ctx.line.replace(`>${text}<`, `>{t('${key}')}<`);
  }
  // 2. Text with JSX expression: Текст → {t('key')}
  else if (ctx.line.includes(text) && !ctx.line.includes(`"${text}"`)) {
    newLine = ctx.line.replace(text, `{t('${key}')}`);
  }
  // 3. Quoted attribute: "Текст" → {t('key')}
  else if (ctx.line.includes(`"${text}"`)) {
    newLine = ctx.line.replace(`"${text}"`, `{t('${key}')}`);
  }
  // 4. Fallback: use snippet if available
  else if (issue.snippet && ctx.line.includes(issue.snippet)) {
    newLine = ctx.line.replace(issue.snippet, replacement);
  }

  // No change made
  if (newLine === ctx.line) {
    return null;
  }

  return createReplaceLine(issue.file, issue.line, ctx.line, newLine);
}

/**
 * Check if the t() import is already present in the file
 */
export function hasI18nImport(content: string): boolean {
  return /import\s+.*\bt\b.*from\s+['"]@piternow\/shared['"]/g.test(content);
}

/**
 * Generate import statement for t function
 */
export function generateI18nImport(): string {
  return "import { t } from '@piternow/shared';";
}
