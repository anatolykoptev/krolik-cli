/**
 * @module commands/audit/enrichment/code-snippets
 * @description Extract code snippets for audit issues
 *
 * Provides code snippet extraction with context lines for audit reports.
 * Uses fileCache for efficient file reading.
 *
 * @example
 * ```typescript
 * import { extractCodeSnippet } from './code-snippets';
 *
 * const snippet = extractCodeSnippet('/path/to/file.ts', 42, 5);
 * // Returns 5 lines before and after line 42
 * ```
 */

import { fileCache } from '../../../lib/@cache';
import type { CodeSnippet } from './snippet-types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default number of context lines before and after the target line */
const DEFAULT_CONTEXT_LINES = 5;

/** Maximum snippet length to prevent huge outputs */
const MAX_SNIPPET_LINES = 30;

// ============================================================================
// SNIPPET EXTRACTION
// ============================================================================

/**
 * Extract code snippet from a file at a specific line with surrounding context
 *
 * @param filePath - Absolute path to the file
 * @param line - 1-indexed line number
 * @param contextLines - Number of lines to include before and after
 * @returns CodeSnippet with the extracted code and line range
 *
 * @example
 * ```typescript
 * const snippet = extractCodeSnippet('/src/utils.ts', 42, 3);
 * // Returns lines 39-45 with line 42 highlighted
 * ```
 */
export function extractCodeSnippet(
  filePath: string,
  line: number,
  contextLines: number = DEFAULT_CONTEXT_LINES,
): CodeSnippet | null {
  try {
    const content = fileCache.get(filePath);
    return extractSnippetFromContent(content, line, contextLines);
  } catch {
    // File not found or not readable
    return null;
  }
}

/**
 * Extract snippet directly from content string
 *
 * @param content - File content
 * @param line - 1-indexed line number
 * @param contextLines - Number of context lines
 * @returns CodeSnippet or null if line is out of bounds
 */
export function extractSnippetFromContent(
  content: string,
  line: number,
  contextLines: number = DEFAULT_CONTEXT_LINES,
): CodeSnippet | null {
  const lines = content.split('\n');

  // Validate line number
  if (line < 1 || line > lines.length) {
    return null;
  }

  // Calculate range (0-indexed internally, 1-indexed in output)
  const lineIndex = line - 1;
  const startIndex = Math.max(0, lineIndex - contextLines);
  const endIndex = Math.min(lines.length - 1, lineIndex + contextLines);

  // Limit total lines
  const totalLines = endIndex - startIndex + 1;
  if (totalLines > MAX_SNIPPET_LINES) {
    // Reduce context to fit within limit
    const halfLimit = Math.floor(MAX_SNIPPET_LINES / 2);
    const adjustedStart = Math.max(0, lineIndex - halfLimit);
    const adjustedEnd = Math.min(lines.length - 1, lineIndex + halfLimit);
    return createSnippet(lines, adjustedStart, adjustedEnd, lineIndex);
  }

  return createSnippet(lines, startIndex, endIndex, lineIndex);
}

/**
 * Extract a multi-line snippet for a range (e.g., entire function)
 *
 * @param filePath - Absolute path to the file
 * @param startLine - Start line (1-indexed)
 * @param endLine - End line (1-indexed)
 * @returns CodeSnippet for the range
 */
export function extractRangeSnippet(
  filePath: string,
  startLine: number,
  endLine: number,
): CodeSnippet | null {
  try {
    const content = fileCache.get(filePath);
    return extractRangeFromContent(content, startLine, endLine);
  } catch {
    return null;
  }
}

/**
 * Extract range snippet from content
 */
export function extractRangeFromContent(
  content: string,
  startLine: number,
  endLine: number,
): CodeSnippet | null {
  const lines = content.split('\n');

  // Validate line range
  if (startLine < 1 || endLine > lines.length || startLine > endLine) {
    return null;
  }

  const startIndex = startLine - 1;
  const endIndex = Math.min(endLine - 1, startIndex + MAX_SNIPPET_LINES - 1);

  const snippetLines = lines.slice(startIndex, endIndex + 1);
  const code = snippetLines.join('\n');

  return {
    code,
    startLine,
    endLine: endIndex + 1,
    highlightLine: startLine, // Highlight first line by default
    truncated: endIndex + 1 < endLine,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create a CodeSnippet from line array and range
 */
function createSnippet(
  lines: string[],
  startIndex: number,
  endIndex: number,
  highlightIndex: number,
): CodeSnippet {
  const snippetLines = lines.slice(startIndex, endIndex + 1);
  const code = snippetLines.join('\n');

  return {
    code,
    startLine: startIndex + 1,
    endLine: endIndex + 1,
    highlightLine: highlightIndex + 1,
    truncated: false,
  };
}

/**
 * Format snippet as XML with CDATA wrapper
 *
 * @param snippet - CodeSnippet to format
 * @param indent - Number of spaces for indentation
 * @returns Formatted XML string
 */
export function formatSnippetAsXml(snippet: CodeSnippet, indent: number = 0): string {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];

  const attrs = `lines="${snippet.startLine}-${snippet.endLine}"`;
  const truncatedAttr = snippet.truncated ? ' truncated="true"' : '';

  lines.push(`${pad}<code-snippet ${attrs}${truncatedAttr}><![CDATA[`);
  lines.push(snippet.code);
  lines.push(`${pad}]]></code-snippet>`);

  return lines.join('\n');
}
