/**
 * @module commands/fix/core/line-utils
 * @description Line manipulation utilities for fix strategies
 */

// ============================================================================
// TYPES
// ============================================================================

export interface LineContext {
  /** The full line content */
  line: string;
  /** Trimmed line content */
  trimmed: string;
  /** 0-based index in the lines array */
  index: number;
  /** 1-based line number */
  lineNumber: number;
}

// ============================================================================
// LINE EXTRACTION
// ============================================================================

/**
 * Split content into lines array
 */
export function splitLines(content: string): string[] {
  return content.split('\n');
}

/**
 * Get line context from content at a specific line number
 * Returns null if line doesn't exist
 */
export function getLineContext(content: string, lineNumber: number): LineContext | null {
  if (lineNumber < 1) return null;

  const lines = splitLines(content);
  const index = lineNumber - 1;
  const line = lines[index];

  if (line === undefined) return null;

  return {
    line,
    trimmed: line.trim(),
    index,
    lineNumber,
  };
}

/**
 * Get multiple lines from content
 * startLine and endLine are 1-based
 */
export function getLines(content: string, startLine: number, endLine: number): string[] {
  const lines = splitLines(content);
  return lines.slice(startLine - 1, endLine);
}

/**
 * Join lines back into content
 */
export function joinLines(lines: string[]): string {
  return lines.join('\n');
}

/**
 * Count total lines in content
 */
export function countLines(content: string): number {
  return splitLines(content).length;
}

// ============================================================================
// LINE CHECKS
// ============================================================================

/**
 * Check if line starts with any of the prefixes (trimmed)
 */
export function lineStartsWith(line: string, prefixes: string[]): boolean {
  const trimmed = line.trim();
  return prefixes.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * Check if line ends with any of the suffixes (trimmed)
 */
export function lineEndsWith(line: string, suffixes: string[]): boolean {
  const trimmed = line.trim();
  return suffixes.some((suffix) => trimmed.endsWith(suffix));
}

/**
 * Check if line contains any of the patterns
 */
export function lineContains(line: string, patterns: string[]): boolean {
  return patterns.some((pattern) => line.includes(pattern));
}

/**
 * Check if line is a comment
 */
export function isComment(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

/**
 * Check if line is empty or whitespace only
 */
export function isEmptyLine(line: string): boolean {
  return line.trim() === '';
}
