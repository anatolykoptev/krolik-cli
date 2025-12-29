/**
 * @module lib/@ast/position
 * @description Low-level position utilities for source code navigation
 *
 * This module contains pure utility functions for working with source code
 * positions and offsets. It has NO dependencies on other modules to avoid
 * circular dependencies.
 *
 * Belongs to utils layer (layer 0) - can be used by any module.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Position in source code (1-indexed)
 */
export interface Position {
  line: number;
  column: number;
}

// ============================================================================
// LINE OFFSET UTILITIES
// ============================================================================

/**
 * Calculate line offsets for position mapping
 *
 * Line offsets allow converting byte offsets to line/column positions.
 * Each offset marks the byte position where a new line starts.
 *
 * @param content - Source code content
 * @returns Array of byte offsets where lines start
 *
 * @example
 * const offsets = calculateLineOffsets("line1\nline2\nline3");
 * // Returns: [0, 6, 12] (line 1 at 0, line 2 at 6, line 3 at 12)
 */
export function calculateLineOffsets(content: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

// ============================================================================
// OFFSET CONVERSION
// ============================================================================

/**
 * Convert byte offset to line/column position (1-indexed)
 *
 * @param offset - Byte offset in source code
 * @param lineOffsets - Pre-calculated line offsets
 * @returns Position with 1-indexed line and column
 *
 * @example
 * const offsets = calculateLineOffsets("line1\nline2");
 * const pos = offsetToPosition(6, offsets);
 * // Returns: { line: 2, column: 1 }
 */
export function offsetToPosition(offset: number, lineOffsets: number[]): Position {
  let line = 0;
  for (let i = 0; i < lineOffsets.length; i++) {
    if ((lineOffsets[i] ?? 0) > offset) {
      break;
    }
    line = i;
  }
  const column = offset - (lineOffsets[line] ?? 0);
  return { line: line + 1, column: column + 1 };
}

/**
 * Convert byte offset to line number (1-indexed)
 *
 * Note: SWC uses 1-based byte offsets (first char is at offset 1)
 * Uses binary search for O(log n) performance.
 *
 * @param offset - Byte offset from SWC AST (1-based)
 * @param lineOffsets - Pre-calculated line offsets
 * @returns 1-indexed line number
 *
 * @example
 * const offsets = calculateLineOffsets("line1\nline2");
 * const line = offsetToLine(6, offsets); // Returns 2
 */
export function offsetToLine(offset: number, lineOffsets: number[]): number {
  // SWC offsets are 1-based, convert to 0-based for our calculation
  const zeroBasedOffset = offset - 1;

  // Binary search for efficiency
  let low = 0;
  let high = lineOffsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const currentOffset = lineOffsets[mid] ?? 0;
    const nextOffset = lineOffsets[mid + 1] ?? Number.MAX_SAFE_INTEGER;

    if (zeroBasedOffset >= currentOffset && zeroBasedOffset < nextOffset) {
      return mid + 1; // 1-based line numbers
    }

    if (zeroBasedOffset < currentOffset) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return 1; // Default to line 1
}

// ============================================================================
// SNIPPET EXTRACTION
// ============================================================================

/**
 * Extract code snippet from content at given offset
 *
 * Returns the trimmed line content at the specified offset,
 * truncated to 80 characters.
 *
 * @param content - Source code content
 * @param offset - Byte offset from SWC AST (1-based)
 * @param lineOffsets - Pre-calculated line offsets
 * @returns Trimmed line content (max 80 chars)
 *
 * @example
 * const offsets = calculateLineOffsets(code);
 * const snippet = getSnippet(code, 42, offsets);
 * // Returns: "const x = 1;"
 */
export function getSnippet(content: string, offset: number, lineOffsets: number[]): string {
  const lineNum = offsetToLine(offset, lineOffsets) - 1;
  const lines = content.split('\n');
  const line = lines[lineNum] ?? '';
  return line.trim().slice(0, 80);
}

/**
 * Extract context string from content at position
 *
 * Similar to getSnippet but works with line start offset directly.
 *
 * @param content - Source code content
 * @param offset - Byte offset from SWC AST (1-based)
 * @param lineOffsets - Pre-calculated line offsets
 * @returns Trimmed line content (max 80 chars)
 */
export function getContext(content: string, offset: number, lineOffsets: number[]): string {
  const line = offsetToLine(offset, lineOffsets);
  const lineStart = lineOffsets[line - 1] ?? 0;

  // Find the actual line end (next newline or EOF)
  let lineEnd = content.indexOf('\n', lineStart);
  if (lineEnd === -1) {
    lineEnd = content.length;
  }
  const lineContent = content.slice(lineStart, lineEnd).trim();

  const MAX_CONTEXT_LENGTH = 80;
  return lineContent.slice(0, MAX_CONTEXT_LENGTH);
}
