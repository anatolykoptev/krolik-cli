/**
 * @module lib/@swc/__tests__/string-context.test
 * @description Tests for string/comment detection utilities
 *
 * NOTE: This file tests the unified string-context module from @lib/@swc.
 * The original core/string-utils.ts was consolidated into @lib/@swc/string-context.ts
 */

import { describe, expect, it } from 'vitest';
import { escapeRegex } from '../../../../../src/lib/@sanitize/regex';
import {
  getLineContent,
  getLineNumber,
  isInsideComment,
  isInsideLineComment,
  isInsideString,
  isInsideStringLine,
  isInsideStringOrComment,
} from '../../../../../src/lib/@swc';

describe('string-context (from @lib/@swc)', () => {
  describe('isInsideStringLine (line-level)', () => {
    it('detects position inside double quotes', () => {
      const line = 'const x = "hello world";';
      expect(isInsideStringLine(line, 15)).toBe(true); // Inside "hello world"
      expect(isInsideStringLine(line, 10)).toBe(false); // Before the string
      expect(isInsideStringLine(line, 23)).toBe(false); // After the string
    });

    it('detects position inside single quotes', () => {
      const line = "const x = 'hello world';";
      expect(isInsideStringLine(line, 15)).toBe(true);
      expect(isInsideStringLine(line, 10)).toBe(false);
    });

    it('detects position inside template literals', () => {
      const line = 'const x = `hello world`;';
      expect(isInsideStringLine(line, 15)).toBe(true);
      expect(isInsideStringLine(line, 10)).toBe(false);
    });

    it('handles escaped quotes', () => {
      const line = 'const x = "hello \\"world\\"";';
      expect(isInsideStringLine(line, 15)).toBe(true); // Still inside string
      expect(isInsideStringLine(line, 20)).toBe(true); // After escaped quote
    });

    it('handles multiple strings on same line', () => {
      const line = 'const x = "hello"; const y = "world";';
      expect(isInsideStringLine(line, 13)).toBe(true); // Inside "hello"
      expect(isInsideStringLine(line, 18)).toBe(false); // Between strings
      expect(isInsideStringLine(line, 31)).toBe(true); // Inside "world"
    });
  });

  describe('isInsideString (full-content)', () => {
    it('detects position inside string in full content', () => {
      const content = 'const x = "hello world";';
      expect(isInsideString(content, 15)).toBe(true);
      expect(isInsideString(content, 10)).toBe(false);
    });

    it('handles template expressions correctly', () => {
      const content = 'const x = `hello ${name} world`;';
      expect(isInsideString(content, 13)).toBe(true); // Inside "hello "
      // Inside ${} expression - NOT in string context
      expect(isInsideString(content, 20)).toBe(false); // Inside ${name}
      expect(isInsideString(content, 25)).toBe(true); // Inside " world"
    });
  });

  describe('isInsideLineComment', () => {
    it('detects position inside line comment', () => {
      const line = 'const x = 5; // comment';
      expect(isInsideLineComment(line, 18)).toBe(true);
      expect(isInsideLineComment(line, 10)).toBe(false);
    });

    it('ignores comment markers inside strings', () => {
      const line = 'const url = "http://example.com";';
      expect(isInsideLineComment(line, 20)).toBe(false);
    });
  });

  describe('isInsideComment (full-content)', () => {
    it('detects position inside line comment', () => {
      const content = 'const x = 5; // comment';
      expect(isInsideComment(content, 18)).toBe(true);
      expect(isInsideComment(content, 10)).toBe(false);
    });

    it('detects position inside block comment', () => {
      const content = 'const x = 5; /* comment */';
      expect(isInsideComment(content, 18)).toBe(true);
      expect(isInsideComment(content, 10)).toBe(false);
    });

    it('ignores comment markers inside strings', () => {
      const content = 'const url = "http://example.com";';
      expect(isInsideComment(content, 20)).toBe(false);

      const content2 = 'const code = "/* not a comment */";';
      expect(isInsideComment(content2, 20)).toBe(false);
    });
  });

  describe('isInsideStringOrComment (full content)', () => {
    it('detects position inside multi-line block comment', () => {
      const content = `const x = 5;
/* This is a
   multi-line comment */
const y = 10;`;
      const firstLineLength = 'const x = 5;\n'.length;
      const commentPos = firstLineLength + 10; // Inside "multi-line"
      expect(isInsideStringOrComment(content, commentPos)).toBe(true);
    });

    it('detects position inside template literal with expressions', () => {
      const content = 'const x = `hello ${name} world`;';
      expect(isInsideStringOrComment(content, 13)).toBe(true); // Inside "hello "
      expect(isInsideStringOrComment(content, 25)).toBe(true); // Inside " world"
    });

    it('handles escaped characters properly', () => {
      const content = 'const x = "hello \\"world\\" test";';
      expect(isInsideStringOrComment(content, 15)).toBe(true);
      expect(isInsideStringOrComment(content, 22)).toBe(true);
    });

    it('handles block comment end correctly', () => {
      const content = '/* comment */ const x = 5;';
      expect(isInsideStringOrComment(content, 5)).toBe(true); // Inside comment
      expect(isInsideStringOrComment(content, 20)).toBe(false); // After comment
    });
  });

  describe('getLineNumber', () => {
    it('returns correct line number for character index', () => {
      const content = 'line1\nline2\nline3';
      expect(getLineNumber(content, 0)).toBe(1); // First char
      expect(getLineNumber(content, 6)).toBe(2); // First char of line2
      expect(getLineNumber(content, 12)).toBe(3); // First char of line3
    });
  });

  describe('getLineContent', () => {
    it('returns correct line content', () => {
      const content = 'line1\nline2\nline3';
      expect(getLineContent(content, 1)).toBe('line1');
      expect(getLineContent(content, 2)).toBe('line2');
      expect(getLineContent(content, 3)).toBe('line3');
    });

    it('returns empty string for out of bounds', () => {
      const content = 'line1\nline2';
      expect(getLineContent(content, 10)).toBe('');
    });
  });

  describe('escapeRegex (from @lib/@sanitize)', () => {
    it('escapes regex special characters', () => {
      expect(escapeRegex('hello.world')).toBe('hello\\.world');
      expect(escapeRegex('a+b*c?')).toBe('a\\+b\\*c\\?');
      expect(escapeRegex('[test]')).toBe('\\[test\\]');
      expect(escapeRegex('(a|b)')).toBe('\\(a\\|b\\)');
      expect(escapeRegex('a{1,2}')).toBe('a\\{1,2\\}');
      expect(escapeRegex('$100')).toBe('\\$100');
      expect(escapeRegex('^start')).toBe('\\^start');
    });

    it('handles strings without special characters', () => {
      expect(escapeRegex('hello')).toBe('hello');
      expect(escapeRegex('test123')).toBe('test123');
    });
  });
});
