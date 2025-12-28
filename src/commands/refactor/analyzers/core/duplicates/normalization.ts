/**
 * @module commands/refactor/analyzers/core/duplicates/normalization
 * @description Function body normalization for comparison
 */

import { hashContent } from '../../shared';

/**
 * Normalize function body for comparison
 * Removes comments, whitespace variations, normalizes strings and numbers
 */
export function normalizeBody(body: string): string {
  return (
    body
      // Remove single-line comments
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments (non-greedy)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalize all strings to placeholder (handle escapes)
      .replace(/'(?:[^'\\]|\\.)*'/g, "'STR'")
      .replace(/"(?:[^"\\]|\\.)*"/g, '"STR"')
      .replace(/`(?:[^`\\]|\\.)*`/g, '`STR`')
      // Normalize numbers
      .replace(/\b\d+\.?\d*\b/g, 'NUM')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Hash function body using MD5
 * Uses shared hashContent utility
 */
export function hashBody(body: string): string {
  return hashContent(body);
}
