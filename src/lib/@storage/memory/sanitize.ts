/**
 * @module lib/@storage/memory/sanitize
 * @description SQL/FTS5 input sanitization utilities (CWE-89 prevention)
 */

/**
 * Escape LIKE pattern special characters
 * Prevents LIKE pattern injection via %, _, and \
 *
 * @param str - Input string to escape
 * @returns Escaped string safe for LIKE patterns
 */
export function escapeLikePattern(str: string): string {
  return str
    .replace(/\\/g, '\\\\') // Escape backslash first
    .replace(/%/g, '\\%') // Escape %
    .replace(/_/g, '\\_'); // Escape _
}

/**
 * Sanitize FTS5 query string
 * Removes/escapes dangerous FTS5 operators to prevent query injection
 *
 * @param str - Input query string
 * @returns Sanitized string safe for FTS5 MATCH
 */
export function sanitizeFtsQuery(str: string): string {
  return (
    str
      // Remove quotes (can change tokenization)
      .replace(/['"]/g, '')
      // Remove FTS5 operators that could be exploited
      .replace(/\b(AND|OR|NOT|NEAR)\b/gi, '')
      // Remove prefix/suffix operators
      .replace(/[-^*]/g, '')
      // Remove parentheses (grouping)
      .replace(/[()]/g, '')
      // Collapse multiple spaces
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Build safe LIKE pattern with proper escaping
 *
 * @param str - Input string
 * @param type - Pattern type: 'contains', 'starts', 'ends', 'exact'
 * @returns Safe LIKE pattern
 */
export function buildLikePattern(
  str: string,
  type: 'contains' | 'starts' | 'ends' | 'exact' = 'contains',
): string {
  const escaped = escapeLikePattern(str);
  switch (type) {
    case 'contains':
      return `%${escaped}%`;
    case 'starts':
      return `${escaped}%`;
    case 'ends':
      return `%${escaped}`;
    case 'exact':
      return escaped;
  }
}

/**
 * Build safe FTS5 query with prefix matching
 *
 * @param query - User's search query
 * @returns Safe FTS5 MATCH query string
 */
export function buildFtsQuery(query: string): string {
  const sanitized = sanitizeFtsQuery(query);
  const words = sanitized.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) return '';

  // Add prefix matching for each word
  return words.map((word) => `${word}*`).join(' OR ');
}
