/**
 * @module lib/@ast/swc/string-context
 * @description Lightweight string/comment context detection without AST parsing.
 *
 * Provides utilities to determine if a given position in source code is inside
 * a string literal or comment. Uses character scanning for fast, allocation-free
 * detection.
 *
 * Handles:
 * - Single-quoted strings: 'text'
 * - Double-quoted strings: "text"
 * - Template literals: `text` (including ${expressions})
 * - Line comments: // comment
 * - Block comments: /* comment *​/
 * - Escape sequences: \", \', \`, \\
 *
 * @example
 * ```typescript
 * import { isInsideString, isInsideComment, isInsideStringOrComment } from '@/lib/@ast/swc';
 *
 * const code = 'const x = "hello"; // greeting';
 *
 * // Check if position 12 (inside "hello") is in a string
 * isInsideString(code, 12); // true
 *
 * // Check if position 25 (inside comment) is in a comment
 * isInsideComment(code, 25); // true
 *
 * // Combined check
 * isInsideStringOrComment(code, 12); // true
 * isInsideStringOrComment(code, 25); // true
 * ```
 */

/**
 * Check if a position is inside a string literal.
 *
 * Handles:
 * - Single quotes: 'string'
 * - Double quotes: "string"
 * - Template literals: `string`
 * - Escape sequences: \", \', \`, \\
 * - Template expressions: ${...} (correctly exits string context inside expression)
 *
 * @param content - Source code content (full file or snippet)
 * @param offset - Character offset to check (0-indexed)
 * @returns true if the offset is inside a string literal
 *
 * @example
 * ```typescript
 * const code = 'const msg = "hello";';
 * isInsideString(code, 14); // true (inside "hello")
 * isInsideString(code, 8);  // false (at 'msg')
 * ```
 */
export function isInsideString(content: string, offset: number): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let templateBraceDepth = 0;
  let escaped = false;

  // Also track comments to avoid false positives
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < offset && i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Handle escape sequences
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && (inSingleQuote || inDoubleQuote || inTemplate)) {
      escaped = true;
      continue;
    }

    // Handle newline ending line comment
    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    // Handle block comment end
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // Skip the '/'
      }
      continue;
    }

    // Check for comment start (only when not in string)
    if (!inSingleQuote && !inDoubleQuote && !inTemplate) {
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        i++; // Skip the second '/'
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++; // Skip the '*'
        continue;
      }
    }

    // Handle template literal expressions ${...}
    if (inTemplate && templateBraceDepth === 0 && char === '$' && nextChar === '{') {
      templateBraceDepth = 1;
      i++; // Skip the '{'
      continue;
    }

    // Track brace depth inside template expressions
    if (inTemplate && templateBraceDepth > 0) {
      if (char === '{') {
        templateBraceDepth++;
      } else if (char === '}') {
        templateBraceDepth--;
      }
      continue;
    }

    // String handling
    if (char === "'" && !inDoubleQuote && !inTemplate) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && !inTemplate) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inTemplate = !inTemplate;
      if (!inTemplate) {
        templateBraceDepth = 0;
      }
    }
  }

  // Inside string if in any string context and not inside a template expression
  return inSingleQuote || inDoubleQuote || (inTemplate && templateBraceDepth === 0);
}

/**
 * Check if a position is inside a comment (line or block).
 *
 * Handles:
 * - Line comments: // comment (extends to end of line)
 * - Block comments: /* comment *​/ (can span multiple lines)
 * - Comments inside strings are correctly ignored
 *
 * @param content - Source code content (full file or snippet)
 * @param offset - Character offset to check (0-indexed)
 * @returns true if the offset is inside a comment
 *
 * @example
 * ```typescript
 * const code = 'const x = 1; // value';
 * isInsideComment(code, 16); // true (inside comment)
 * isInsideComment(code, 8);  // false (at 'x')
 *
 * const multiline = 'a /* comment *​/ b';
 * isInsideComment(multiline, 6); // true (inside block comment)
 * ```
 */
export function isInsideComment(content: string, offset: number): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let templateBraceDepth = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = 0; i < offset && i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Handle escape sequences in strings
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && (inSingleQuote || inDoubleQuote || inTemplate)) {
      escaped = true;
      continue;
    }

    // Handle newline ending line comment
    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    // Handle block comment end
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // Skip the '/'
      }
      continue;
    }

    // String context tracking (to ignore comments inside strings)
    if (!inLineComment && !inBlockComment) {
      // Handle template expressions
      if (inTemplate && templateBraceDepth === 0 && char === '$' && nextChar === '{') {
        templateBraceDepth = 1;
        i++;
        continue;
      }

      if (inTemplate && templateBraceDepth > 0) {
        if (char === '{') {
          templateBraceDepth++;
        } else if (char === '}') {
          templateBraceDepth--;
        }
        // Inside template expression, check for comment start
        if (templateBraceDepth > 0 && char === '/' && nextChar === '/') {
          inLineComment = true;
          i++;
          continue;
        }
        if (templateBraceDepth > 0 && char === '/' && nextChar === '*') {
          inBlockComment = true;
          i++;
          continue;
        }
        continue;
      }

      // String toggling
      if (char === "'" && !inDoubleQuote && !inTemplate) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote && !inTemplate) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inTemplate = !inTemplate;
        if (!inTemplate) templateBraceDepth = 0;
      }

      // Check for comment start (only when not in string)
      if (!inSingleQuote && !inDoubleQuote && !inTemplate) {
        if (char === '/' && nextChar === '/') {
          inLineComment = true;
          i++;
          continue;
        }
        if (char === '/' && nextChar === '*') {
          inBlockComment = true;
          i++;
        }
      }
    }
  }

  return inLineComment || inBlockComment;
}

/**
 * Check if a position is inside a string literal or comment.
 *
 * This is the most comprehensive check, combining both string and comment detection.
 * Use this when you need to filter out any non-code context (e.g., when searching
 * for patterns that should only match in actual code).
 *
 * Handles all cases from both isInsideString and isInsideComment:
 * - Single/double/template strings with escape sequences
 * - Template expressions: ${...}
 * - Line comments: //
 * - Block comments: /* *​/
 *
 * @param content - Source code content (full file or snippet)
 * @param offset - Character offset to check (0-indexed)
 * @returns true if the offset is inside a string literal or comment
 *
 * @example
 * ```typescript
 * const code = `const x = "hello"; // comment`;
 *
 * isInsideStringOrComment(code, 12); // true (inside string "hello")
 * isInsideStringOrComment(code, 22); // true (inside comment)
 * isInsideStringOrComment(code, 6);  // false (at 'x')
 * ```
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Parser logic requires complex state machine
export function isInsideStringOrComment(content: string, offset: number): boolean {
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let templateBraceDepth = 0;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = 0; i < offset && i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    // Handle escape sequences in strings
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === '\\' && (inSingleQuote || inDoubleQuote || inTemplate)) {
      escaped = true;
      continue;
    }

    // Handle newline ending line comment
    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    // Handle block comment end
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // Skip the '/'
      }
      continue;
    }

    // Handle template expressions ${...}
    if (inTemplate && templateBraceDepth === 0 && char === '$' && nextChar === '{') {
      templateBraceDepth = 1;
      i++;
      continue;
    }

    // Track brace depth inside template expressions
    if (inTemplate && templateBraceDepth > 0) {
      if (char === '{') {
        templateBraceDepth++;
      } else if (char === '}') {
        templateBraceDepth--;
      }
      // Inside template expression, check for comments
      if (templateBraceDepth > 0) {
        if (char === '/' && nextChar === '/') {
          inLineComment = true;
          i++;
          continue;
        }
        if (char === '/' && nextChar === '*') {
          inBlockComment = true;
          i++;
          continue;
        }
      }
      continue;
    }

    // String toggling (only when not in comment)
    if (char === "'" && !inDoubleQuote && !inTemplate) {
      inSingleQuote = !inSingleQuote;
    } else if (char === '"' && !inSingleQuote && !inTemplate) {
      inDoubleQuote = !inDoubleQuote;
    } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inTemplate = !inTemplate;
      if (!inTemplate) templateBraceDepth = 0;
    }

    // Check for comment start (only when not in string)
    if (!inSingleQuote && !inDoubleQuote && !inTemplate) {
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++;
      }
    }
  }

  // Return true if in any string or comment context
  // For template literals, only count as "in string" if not inside an expression
  const inString = inSingleQuote || inDoubleQuote || (inTemplate && templateBraceDepth === 0);
  const inComment = inLineComment || inBlockComment;

  return inString || inComment;
}

/**
 * Check if a line-level position is inside a string (convenience function).
 *
 * This is a simpler, faster version for single-line checks where you don't
 * need to handle multi-line constructs. It's useful for quick line-by-line
 * scanning where block comments and template literals aren't a concern.
 *
 * @param line - Single line of code (no newlines)
 * @param index - Character index within the line (0-indexed)
 * @returns true if inside a string literal on this line
 *
 * @example
 * ```typescript
 * const line = 'const x = "hello world";';
 * isInsideStringLine(line, 14); // true (inside "hello world")
 * isInsideStringLine(line, 6);  // false (at 'x')
 * ```
 */
export function isInsideStringLine(line: string, index: number): boolean {
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < index && i < line.length; i++) {
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
 * Check if a line-level position is inside a line comment (convenience function).
 *
 * Only detects line comments (//), not block comments. For block comment
 * detection, use isInsideComment with full content.
 *
 * @param line - Single line of code (no newlines)
 * @param index - Character index within the line (0-indexed)
 * @returns true if inside a line comment on this line
 *
 * @example
 * ```typescript
 * const line = 'const x = 1; // value';
 * isInsideLineComment(line, 18); // true (inside comment)
 * isInsideLineComment(line, 6);  // false (at 'x')
 * ```
 */
export function isInsideLineComment(line: string, index: number): boolean {
  const before = line.slice(0, index);
  const commentStart = before.indexOf('//');

  // No line comment found before this position
  if (commentStart === -1) return false;

  // Check if the // itself is inside a string
  return !isInsideStringLine(line, commentStart);
}

// ============================================================================
// LINE UTILITIES
// ============================================================================

/**
 * Get line number from character index in content.
 *
 * @param content - Full file content
 * @param index - Character index (0-indexed)
 * @returns Line number (1-indexed)
 *
 * @example
 * ```typescript
 * const code = 'line1\nline2\nline3';
 * getLineNumber(code, 0);  // 1 (start of line1)
 * getLineNumber(code, 6);  // 2 (start of line2)
 * getLineNumber(code, 12); // 3 (start of line3)
 * ```
 */
export function getLineNumber(content: string, index: number): number {
  const before = content.slice(0, index);
  return before.split('\n').length;
}

/**
 * Get the content of a specific line.
 *
 * @param content - Full file content
 * @param lineNumber - Line number (1-indexed)
 * @returns Line content (without newline)
 *
 * @example
 * ```typescript
 * const code = 'const x = 1;\nconst y = 2;';
 * getLineContent(code, 1); // 'const x = 1;'
 * getLineContent(code, 2); // 'const y = 2;'
 * ```
 */
export function getLineContent(content: string, lineNumber: number): string {
  const lines = content.split('\n');
  return lines[lineNumber - 1] ?? '';
}
