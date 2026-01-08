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

class ParserState {
  inSingleQuote = false;
  inDoubleQuote = false;
  inTemplate = false;
  templateBraceDepth = 0;
  inLineComment = false;
  inBlockComment = false;
  escaped = false;

  process(char: string, nextChar: string): { skip: number } {
    let skip = 0;

    // Handle escape sequences in strings
    if (this.escaped) {
      this.escaped = false;
      return { skip };
    }

    if (char === '\\' && (this.inSingleQuote || this.inDoubleQuote || this.inTemplate)) {
      this.escaped = true;
      return { skip };
    }

    // Handle newline ending line comment
    if (this.inLineComment) {
      if (char === '\n') {
        this.inLineComment = false;
      }
      return { skip };
    }

    // Handle block comment end
    if (this.inBlockComment) {
      if (char === '*' && nextChar === '/') {
        this.inBlockComment = false;
        skip = 1; // Skip the '/'
      }
      return { skip };
    }

    // Handle template expressions ${...}
    if (this.inTemplate && this.templateBraceDepth === 0 && char === '$' && nextChar === '{') {
      this.templateBraceDepth = 1;
      skip = 1; // Skip the '{'
      return { skip };
    }

    // Track brace depth inside template expressions
    if (this.inTemplate && this.templateBraceDepth > 0) {
      if (char === '{') {
        this.templateBraceDepth++;
      } else if (char === '}') {
        this.templateBraceDepth--;
      }
      // Inside template expression, check for comments
      if (this.templateBraceDepth > 0) {
        if (char === '/' && nextChar === '/') {
          this.inLineComment = true;
          skip = 1;
          return { skip };
        }
        if (char === '/' && nextChar === '*') {
          this.inBlockComment = true;
          skip = 1;
          return { skip };
        }
      }
      return { skip };
    }

    // String toggling (only when not in comment)
    if (char === "'" && !this.inDoubleQuote && !this.inTemplate) {
      this.inSingleQuote = !this.inSingleQuote;
    } else if (char === '"' && !this.inSingleQuote && !this.inTemplate) {
      this.inDoubleQuote = !this.inDoubleQuote;
    } else if (char === '`' && !this.inSingleQuote && !this.inDoubleQuote) {
      this.inTemplate = !this.inTemplate;
      if (!this.inTemplate) this.templateBraceDepth = 0;
    }

    // Check for comment start (only when not in string)
    if (!this.inSingleQuote && !this.inDoubleQuote && !this.inTemplate) {
      if (char === '/' && nextChar === '/') {
        this.inLineComment = true;
        skip = 1;
        return { skip };
      }
      if (char === '/' && nextChar === '*') {
        this.inBlockComment = true;
        skip = 1;
      }
    }

    return { skip };
  }

  isInString(): boolean {
    return (
      this.inSingleQuote || this.inDoubleQuote || (this.inTemplate && this.templateBraceDepth === 0)
    );
  }

  isInComment(): boolean {
    return this.inLineComment || this.inBlockComment;
  }
}

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
  const state = new ParserState();

  for (let i = 0; i < offset && i < content.length; i++) {
    const char = content[i] ?? '';
    const nextChar = content[i + 1] ?? '';
    const { skip } = state.process(char, nextChar);
    i += skip;
  }

  return state.isInString();
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
  const state = new ParserState();

  for (let i = 0; i < offset && i < content.length; i++) {
    const char = content[i] ?? '';
    const nextChar = content[i + 1] ?? '';
    const { skip } = state.process(char, nextChar);
    i += skip;
  }

  return state.isInComment();
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
export function isInsideStringOrComment(content: string, offset: number): boolean {
  const state = new ParserState();

  for (let i = 0; i < offset && i < content.length; i++) {
    const char = content[i] ?? '';
    const nextChar = content[i + 1] ?? '';
    const { skip } = state.process(char, nextChar);
    i += skip;
  }

  return state.isInString() || state.isInComment();
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
