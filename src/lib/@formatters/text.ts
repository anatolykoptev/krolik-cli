/**
 * @module lib/formatters/text
 * @description Text formatting utilities
 *
 * Provides utilities for:
 * - String truncation
 * - Padding and alignment
 * - Case conversion
 * - Pluralization
 */

// ============================================================================
// TRUNCATION
// ============================================================================

/**
 * Truncate string with ellipsis
 *
 * @example
 * truncate('Hello World', 8)
 * // Returns: 'Hello...'
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length) + suffix;
}

/**
 * Truncate from the middle, keeping start and end
 *
 * @example
 * truncateMiddle('very-long-filename.ts', 15)
 * // Returns: 'very-l...me.ts'
 */
export function truncateMiddle(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const ellipsis = '...';
  const charsToShow = maxLength - ellipsis.length;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);

  return text.slice(0, frontChars) + ellipsis + text.slice(-backChars);
}

/**
 * Truncate lines, keeping first N
 */
export function truncateLines(
  text: string,
  maxLines: number,
): { text: string; truncated: boolean } {
  const lines = text.split('\n');

  if (lines.length <= maxLines) {
    return { text, truncated: false };
  }

  return {
    text: `${lines.slice(0, maxLines).join('\n')}\n... (truncated)`,
    truncated: true,
  };
}

// ============================================================================
// PADDING & ALIGNMENT
// ============================================================================

/**
 * Pad string to left
 */
export function padLeft(text: string, width: number, char: string = ' '): string {
  return text.padStart(width, char);
}

/**
 * Pad string to right
 */
export function padRight(text: string, width: number, char: string = ' '): string {
  return text.padEnd(width, char);
}

/**
 * Center text within width
 */
export function center(text: string, width: number, char: string = ' '): string {
  if (text.length >= width) return text;

  const padding = width - text.length;
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;

  return char.repeat(leftPad) + text + char.repeat(rightPad);
}

/**
 * Align columns in multi-line text
 */
export function alignColumns(rows: string[][], separator: string = '  '): string {
  if (rows.length === 0) return '';

  // Calculate max width for each column
  const columnWidths: number[] = [];

  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cellWidth = row[i]?.length || 0;
      columnWidths[i] = Math.max(columnWidths[i] || 0, cellWidth);
    }
  }

  // Format each row
  return rows
    .map((row) =>
      row
        .map((cell, i) => padRight(cell || '', columnWidths[i] || 0))
        .join(separator)
        .trimEnd(),
    )
    .join('\n');
}

// ============================================================================
// CASE CONVERSION
// ============================================================================

/**
 * Convert to camelCase
 */
export function toCamelCase(text: string): string {
  return text
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[A-Z]/, (c) => c.toLowerCase());
}

/**
 * Convert to PascalCase
 */
export function toPascalCase(text: string): string {
  return text
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

/**
 * Convert to kebab-case
 */
export function toKebabCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Convert to snake_case
 */
export function toSnakeCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Convert to CONSTANT_CASE
 */
export function toConstantCase(text: string): string {
  return toSnakeCase(text).toUpperCase();
}

// ============================================================================
// PLURALIZATION
// ============================================================================

/**
 * Simple pluralization
 *
 * @example
 * pluralize(1, 'file', 'files') // 'file'
 * pluralize(5, 'file', 'files') // 'files'
 */
export function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

/**
 * Format count with unit
 *
 * @example
 * formatCount(1, 'file', 'files') // '1 file'
 * formatCount(5, 'file', 'files') // '5 files'
 */
export function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${pluralize(count, singular, plural)}`;
}

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Indent all lines
 */
export function indent(text: string, spaces: number = 2): string {
  const padding = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => padding + line)
    .join('\n');
}

/**
 * Remove common leading whitespace (dedent)
 */
export function dedent(text: string): string {
  const lines = text.split('\n');

  // Find minimum indentation (ignore empty lines)
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const leadingSpaces = line.match(/^(\s*)/)?.[1]?.length || 0;
    minIndent = Math.min(minIndent, leadingSpaces);
  }

  if (minIndent === Infinity || minIndent === 0) {
    return text;
  }

  // Remove that indentation from all lines
  return lines.map((line) => (line.trim() === '' ? '' : line.slice(minIndent))).join('\n');
}

/**
 * Wrap text at specified width
 */
export function wordWrap(text: string, width: number = 80): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}

/**
 * Strip ANSI color codes from string
 */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

// NOTE: escapeRegex moved to @sanitize/regex.ts
// Import from '@/lib' or '@/lib/@sanitize' instead
