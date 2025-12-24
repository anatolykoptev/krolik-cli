/**
 * @module commands/fix/core/string-utils
 * @description Shared utilities for string/comment detection in source code
 */

/**
 * Check if a position is inside a string literal (line-level check)
 *
 * Handles:
 * - Single quotes: 'string'
 * - Double quotes: "string"
 * - Template literals: `string`
 * - Escaped quotes: \" \' \`
 *
 * @param line - Single line of code
 * @param index - Character index within the line
 * @returns true if inside string literal
 */
export function isInsideString(line: string, index: number): boolean {
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < index; i++) {
    const char = line[i];

    // Handle escape sequences
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    // Toggle string state
    if (!inString && (char === '"' || char === "'" || char === '`')) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar) {
      inString = false;
      stringChar = '';
    }
  }

  return inString;
}

/**
 * Check if a position is inside a line comment (// ...)
 *
 * Note: This only checks for line comments, not block comments.
 * For block comment detection, use isInsideStringOrComment with full content.
 *
 * @param line - Single line of code
 * @param index - Character index within the line
 * @returns true if inside line comment
 */
export function isInsideLineComment(line: string, index: number): boolean {
  const before = line.slice(0, index);
  const commentStart = before.indexOf('//');

  // No line comment found
  if (commentStart === -1) return false;

  // Check if the // itself is inside a string
  return !isInsideString(line, commentStart);
}

/**
 * Check if a position is inside a comment (line or block)
 *
 * Note: For accurate block comment detection, this checks for /* in the line.
 * For multi-line block comments, use isInsideStringOrComment with full content.
 *
 * @param line - Single line of code
 * @param index - Character index within the line
 * @returns true if inside comment
 */
export function isInsideComment(line: string, index: number): boolean {
  const before = line.slice(0, index);

  // Check for line comment
  if (before.includes('//')) {
    const commentStart = before.indexOf('//');
    if (!isInsideString(line, commentStart)) {
      return true;
    }
  }

  // Check for block comment start
  if (before.includes('/*')) {
    const commentStart = before.lastIndexOf('/*');
    if (!isInsideString(line, commentStart)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a position is inside a string literal or comment (full content check)
 *
 * This is the most accurate check as it handles multi-line constructs:
 * - Template literals with expressions: `${...}`
 * - Multi-line block comments: /* ... *​/
 * - Nested strings within template literals
 *
 * @param content - Full file content
 * @param index - Character index to check
 * @returns true if inside string or comment
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Parser logic requires complex state machine
export function isInsideStringOrComment(content: string, index: number): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = 0; i < index; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Handle escape sequences
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    // Check for comment start (only when not in string)
    if (!inSingleQuote && !inDoubleQuote && !inTemplate && !inBlockComment) {
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        i++; // Skip next char
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++; // Skip next char
        continue;
      }
    }

    // End line comment on newline
    if (inLineComment && char === '\n') {
      inLineComment = false;
      continue;
    }

    // End block comment
    if (inBlockComment && char === '*' && nextChar === '/') {
      inBlockComment = false;
      i++; // Skip next char
      continue;
    }

    // String handling (only when not in comment)
    if (!inLineComment && !inBlockComment) {
      if (char === "'" && !inDoubleQuote && !inTemplate) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote && !inTemplate) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inTemplate = !inTemplate;
      }
    }
  }

  return inSingleQuote || inDoubleQuote || inTemplate || inLineComment || inBlockComment;
}

/**
 * Get line number from character index
 *
 * @param content - Full file content
 * @param index - Character index
 * @returns Line number (1-indexed)
 */
export function getLineNumber(content: string, index: number): number {
  const beforeMatch = content.slice(0, index);
  return beforeMatch.split('\n').length;
}

/**
 * Get the line content for a given line number
 *
 * @param content - Full file content
 * @param lineNumber - Line number (1-indexed)
 * @returns Line content
 */
export function getLineContent(content: string, lineNumber: number): string {
  const lines = content.split('\n');
  return lines[lineNumber - 1] ?? '';
}

// Re-export escapeRegex from shared module for backward compatibility
export { escapeRegex } from '../../../lib/@sanitize/regex';
