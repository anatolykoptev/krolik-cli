/**
 * @module commands/fix/core/__tests__/string-utils.test
 * @description Tests for string/comment detection utilities
 */

import { describe, expect, it } from 'vitest';
import {
  escapeRegex,
  getLineContent,
  getLineNumber,
  isInsideComment,
  isInsideLineComment,
  isInsideString,
  isInsideStringOrComment,
} from '../../../../../src/commands/fix/core/string-utils';

describe('string-utils', () => {
  describe('isInsideString', () => {
    it('detects position inside double quotes', () => {
      const line = 'const x = "hello world";';
      expect(isInsideString(line, 15)).toBe(true); // Inside "hello world"
      expect(isInsideString(line, 10)).toBe(false); // Before the string
      expect(isInsideString(line, 23)).toBe(false); // After the string
    });

    it('detects position inside single quotes', () => {
      const line = "const x = 'hello world';";
      expect(isInsideString(line, 15)).toBe(true);
      expect(isInsideString(line, 10)).toBe(false);
    });

    it('detects position inside template literals', () => {
      const line = 'const x = `hello world`;';
      expect(isInsideString(line, 15)).toBe(true);
      expect(isInsideString(line, 10)).toBe(false);
    });

    it('handles escaped quotes', () => {
      const line = 'const x = "hello \\"world\\"";';
      expect(isInsideString(line, 15)).toBe(true); // Still inside string
      expect(isInsideString(line, 20)).toBe(true); // After escaped quote
    });

    it('handles multiple strings on same line', () => {
      const line = 'const x = "hello"; const y = "world";';
      expect(isInsideString(line, 13)).toBe(true); // Inside "hello"
      expect(isInsideString(line, 18)).toBe(false); // Between strings
      expect(isInsideString(line, 31)).toBe(true); // Inside "world"
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

  describe('isInsideComment', () => {
    it('detects position inside line comment', () => {
      const line = 'const x = 5; // comment';
      expect(isInsideComment(line, 18)).toBe(true);
      expect(isInsideComment(line, 10)).toBe(false);
    });

    it('detects position inside block comment start', () => {
      const line = 'const x = 5; /* comment';
      expect(isInsideComment(line, 18)).toBe(true);
      expect(isInsideComment(line, 10)).toBe(false);
    });

    it('ignores comment markers inside strings', () => {
      const line = 'const url = "http://example.com";';
      expect(isInsideComment(line, 20)).toBe(false);

      const line2 = 'const code = "/* not a comment */";';
      expect(isInsideComment(line2, 20)).toBe(false);
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

  describe('escapeRegex', () => {
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
