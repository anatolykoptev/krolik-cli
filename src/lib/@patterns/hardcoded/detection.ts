/**
 * @module lib/@patterns/hardcoded/detection
 * @description Detection patterns and rules for hardcoded values
 */

import { shouldSkipForHardcoded } from '../skip-patterns';

/**
 * Check if file should be skipped for hardcoded detection
 * Re-exports shouldSkipForHardcoded from skip-patterns for backward compatibility
 *
 * @deprecated Import shouldSkipForHardcoded from '@patterns/skip-patterns' directly
 */
export { shouldSkipForHardcoded as shouldSkipFile };

/**
 * Detection patterns for hardcoded values
 */
export const DETECTION_PATTERNS = {
  /** Magic numbers (2+ digits, not in arrays/types) */
  magicNumber: /(?<![.\w])(\d{2,}|[2-9]\d*)(?![.\w\]])/g,
  /** Hardcoded URLs in strings */
  url: /(["'`])(https?:\/\/[^"'`\s]+)\1/g,
  /** Hex colors */
  hexColor: /#([0-9A-Fa-f]{3}){1,2}\b/g,
  /** Hardcoded Russian text (i18n issues) */
  hardcodedText: /["'`][А-Яа-яЁё][А-Яа-яЁё\s]{10,}["'`]/g,
} as const;

/**
 * Fixable patterns (from issue messages)
 */
export const FIXABLE_PATTERNS = {
  NUMBER: /hardcoded\s+number:\s*(\d+)/i,
  URL: /hardcoded\s+url:\s*(https?:\/\/[^\s]+)/i,
  COLOR: /hardcoded\s+color/i,
  TEXT: /hardcoded\s+string/i,
} as const;

/**
 * Pattern for SCREAMING_SNAKE_CASE constant declarations
 */
export const CONST_DECL_PATTERN = /^\s*(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*=/;

/**
 * File patterns to skip for hardcoded detection
 * @deprecated Use shouldSkipForHardcoded from '../skip-patterns' which combines all patterns
 */
export const SKIP_FILE_PATTERNS = [
  '.config.',
  'schema',
  '.test.',
  '.spec.',
  '__tests__',
  '/constants/', // Pattern definition files
  '/@patterns/', // Pattern library
  '/@swc/', // SWC infrastructure
] as const;

/**
 * Check if line should be skipped (comments, imports, type declarations)
 */
export function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('*') ||
    line.includes('import ') ||
    line.includes('from ') ||
    line.includes(': number') ||
    line.includes(': string') ||
    CONST_DECL_PATTERN.test(line)
  );
}
