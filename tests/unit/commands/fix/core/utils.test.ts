/**
 * @module tests/commands/fix/core/utils.test
 * @description Tests for consolidated utilities in core/utils.ts
 *
 * Phase 4 of FIX-REFACTORING-PLAN: Validates re-exported utilities work correctly
 */

import { describe, expect, it } from 'vitest';
import {
  // Line utilities
  countLines,
  createDeleteLine,
  createFullFileReplace,
  createReplaceLine,
  createReplaceRange,
  createSplitFile,
  endsWithAny,
  getLine,
  getLineContext,
  getLines,
  isComment,
  isEmptyLine,
  isNoOp,
  joinLines,
  lineContains,
  lineEndsWith,
  lineStartsWith,
  splitLines,
  startsWithAny,
  withMetadata,
} from '../../../../../src/commands/fix/core/utils';

describe('core/utils', () => {
  describe('line utilities', () => {
    describe('splitLines', () => {
      it('splits content into lines array', () => {
        const content = 'line1\nline2\nline3';
        expect(splitLines(content)).toEqual(['line1', 'line2', 'line3']);
      });

      it('handles single line content', () => {
        expect(splitLines('single line')).toEqual(['single line']);
      });

      it('handles empty content', () => {
        expect(splitLines('')).toEqual(['']);
      });

      it('preserves empty lines', () => {
        const content = 'line1\n\nline3';
        expect(splitLines(content)).toEqual(['line1', '', 'line3']);
      });
    });

    describe('getLineContext', () => {
      const content = 'function test() {\n  console.log("hello");\n}';

      it('returns correct context for first line', () => {
        const ctx = getLineContext(content, 1);
        expect(ctx).not.toBeNull();
        expect(ctx?.line).toBe('function test() {');
        expect(ctx?.trimmed).toBe('function test() {');
        expect(ctx?.index).toBe(0);
        expect(ctx?.lineNumber).toBe(1);
      });

      it('returns correct context for line with indentation', () => {
        const ctx = getLineContext(content, 2);
        expect(ctx).not.toBeNull();
        expect(ctx?.line).toBe('  console.log("hello");');
        expect(ctx?.trimmed).toBe('console.log("hello");');
        expect(ctx?.index).toBe(1);
        expect(ctx?.lineNumber).toBe(2);
      });

      it('returns null for line number 0', () => {
        expect(getLineContext(content, 0)).toBeNull();
      });

      it('returns null for negative line number', () => {
        expect(getLineContext(content, -1)).toBeNull();
      });

      it('returns null for non-existent line', () => {
        expect(getLineContext(content, 100)).toBeNull();
      });
    });

    describe('getLines', () => {
      const content = 'line1\nline2\nline3\nline4\nline5';

      it('extracts range of lines', () => {
        expect(getLines(content, 2, 4)).toEqual(['line2', 'line3', 'line4']);
      });

      it('handles single line extraction', () => {
        expect(getLines(content, 3, 3)).toEqual(['line3']);
      });

      it('handles extraction from start', () => {
        expect(getLines(content, 1, 2)).toEqual(['line1', 'line2']);
      });

      it('handles extraction to end', () => {
        expect(getLines(content, 4, 5)).toEqual(['line4', 'line5']);
      });
    });

    describe('joinLines', () => {
      it('joins lines with newline', () => {
        expect(joinLines(['line1', 'line2', 'line3'])).toBe('line1\nline2\nline3');
      });

      it('handles single line', () => {
        expect(joinLines(['single'])).toBe('single');
      });

      it('handles empty array', () => {
        expect(joinLines([])).toBe('');
      });
    });

    describe('countLines', () => {
      it('counts lines in content', () => {
        expect(countLines('line1\nline2\nline3')).toBe(3);
      });

      it('counts single line', () => {
        expect(countLines('single')).toBe(1);
      });

      it('counts empty content as 1 line', () => {
        expect(countLines('')).toBe(1);
      });
    });

    describe('lineStartsWith', () => {
      it('checks if trimmed line starts with prefix', () => {
        expect(lineStartsWith('  console.log("test")', ['console.'])).toBe(true);
        expect(lineStartsWith('const x = 1;', ['console.'])).toBe(false);
      });

      it('handles multiple prefixes', () => {
        expect(lineStartsWith('console.log()', ['debugger', 'console.'])).toBe(true);
        expect(lineStartsWith('debugger;', ['debugger', 'console.'])).toBe(true);
        expect(lineStartsWith('alert()', ['debugger', 'console.'])).toBe(false);
      });

      it('handles empty prefixes array', () => {
        expect(lineStartsWith('any line', [])).toBe(false);
      });
    });

    describe('lineEndsWith', () => {
      it('checks if trimmed line ends with suffix', () => {
        expect(lineEndsWith('console.log("test");', [';'])).toBe(true);
        expect(lineEndsWith('console.log("test")  ', [')'])).toBe(true);
        expect(lineEndsWith('const x = {', [';'])).toBe(false);
      });

      it('handles multiple suffixes', () => {
        expect(lineEndsWith('const x = 1;', [';', ')'])).toBe(true);
        expect(lineEndsWith('test()', [';', ')'])).toBe(true);
        expect(lineEndsWith('const x = {', [';', ')'])).toBe(false);
      });
    });

    describe('lineContains', () => {
      it('checks if line contains pattern', () => {
        expect(lineContains('console.log("hello")', ['console'])).toBe(true);
        expect(lineContains('debugger;', ['console'])).toBe(false);
      });

      it('handles multiple patterns', () => {
        expect(lineContains('console.log()', ['console', 'debugger'])).toBe(true);
        expect(lineContains('alert()', ['console', 'debugger'])).toBe(false);
      });
    });

    describe('isComment', () => {
      it('detects line comments', () => {
        expect(isComment('// this is a comment')).toBe(true);
        expect(isComment('  // indented comment')).toBe(true);
      });

      it('detects block comments', () => {
        expect(isComment('/* block comment */')).toBe(true);
        expect(isComment(' * middle of block')).toBe(true);
      });

      it('returns false for non-comments', () => {
        expect(isComment('const x = 1;')).toBe(false);
        expect(isComment('console.log("//");')).toBe(false);
      });
    });

    describe('isEmptyLine', () => {
      it('detects empty lines', () => {
        expect(isEmptyLine('')).toBe(true);
        expect(isEmptyLine('   ')).toBe(true);
        expect(isEmptyLine('\t\t')).toBe(true);
      });

      it('returns false for non-empty lines', () => {
        expect(isEmptyLine('const x = 1;')).toBe(false);
        expect(isEmptyLine('  x  ')).toBe(false);
      });
    });
  });

  describe('fix operations', () => {
    describe('createDeleteLine', () => {
      it('creates delete-line operation', () => {
        const op = createDeleteLine('/test/file.ts', 5, 'console.log("test");');

        expect(op.action).toBe('delete-line');
        expect(op.file).toBe('/test/file.ts');
        expect(op.line).toBe(5);
        expect(op.oldCode).toBe('console.log("test");');
      });
    });

    describe('createReplaceLine', () => {
      it('creates replace-line operation', () => {
        const op = createReplaceLine(
          '/test/file.ts',
          10,
          'const x: any = 1;',
          'const x: unknown = 1;',
        );

        expect(op.action).toBe('replace-line');
        expect(op.file).toBe('/test/file.ts');
        expect(op.line).toBe(10);
        expect(op.oldCode).toBe('const x: any = 1;');
        expect(op.newCode).toBe('const x: unknown = 1;');
      });
    });

    describe('createReplaceRange', () => {
      it('creates replace-range operation', () => {
        const op = createReplaceRange(
          '/test/file.ts',
          5,
          10,
          'function old() {\n  return 1;\n}',
          'function new() {\n  return 2;\n}',
        );

        expect(op.action).toBe('replace-range');
        expect(op.file).toBe('/test/file.ts');
        expect(op.line).toBe(5);
        expect(op.endLine).toBe(10);
        expect(op.oldCode).toBe('function old() {\n  return 1;\n}');
        expect(op.newCode).toBe('function new() {\n  return 2;\n}');
      });
    });

    describe('createFullFileReplace', () => {
      it('creates full file replace operation', () => {
        const oldContent = 'line1\nline2\nline3';
        const newContent = 'new line1\nnew line2';

        const op = createFullFileReplace('/test/file.ts', oldContent, newContent);

        expect(op.action).toBe('replace-range');
        expect(op.file).toBe('/test/file.ts');
        expect(op.line).toBe(1);
        expect(op.endLine).toBe(3);
        expect(op.oldCode).toBe(oldContent);
        expect(op.newCode).toBe(newContent);
      });
    });

    describe('createSplitFile', () => {
      it('creates split-file operation', () => {
        const newFiles = [
          { path: '/test/types.ts', content: 'export type A = string;' },
          { path: '/test/utils.ts', content: 'export function foo() {}' },
        ];

        const op = createSplitFile('/test/file.ts', newFiles);

        expect(op.action).toBe('split-file');
        expect(op.file).toBe('/test/file.ts');
        expect(op.newFiles).toEqual(newFiles);
      });
    });

    describe('withMetadata', () => {
      it('adds metadata to operation', () => {
        const op = createDeleteLine('/test/file.ts', 5, 'console.log()');
        const enhanced = withMetadata(op, {
          functionName: 'extractedHelper',
          description: 'Extracted helper function',
        });

        expect(enhanced.action).toBe('delete-line');
        expect(enhanced.file).toBe('/test/file.ts');
        expect(enhanced.functionName).toBe('extractedHelper');
      });
    });

    describe('isNoOp', () => {
      it('detects no-op replace-line operations', () => {
        const op = createReplaceLine('/test/file.ts', 1, 'same code', 'same code');
        expect(isNoOp(op)).toBe(true);
      });

      it('detects actual replace-line operations', () => {
        const op = createReplaceLine('/test/file.ts', 1, 'old code', 'new code');
        expect(isNoOp(op)).toBe(false);
      });

      it('detects no-op replace-range operations', () => {
        const op = createReplaceRange('/test/file.ts', 1, 5, 'same', 'same');
        expect(isNoOp(op)).toBe(true);
      });

      it('returns false for delete-line operations', () => {
        const op = createDeleteLine('/test/file.ts', 5, 'code');
        expect(isNoOp(op)).toBe(false);
      });
    });
  });

  describe('deprecated helper functions', () => {
    describe('getLine (deprecated)', () => {
      it('gets line at specific number', () => {
        const content = 'line1\nline2\nline3';
        expect(getLine(content, 1)).toBe('line1');
        expect(getLine(content, 2)).toBe('line2');
        expect(getLine(content, 3)).toBe('line3');
      });

      it('returns null for non-existent line', () => {
        expect(getLine('line1', 5)).toBeNull();
      });
    });

    describe('startsWithAny (deprecated)', () => {
      it('checks if trimmed line starts with any prefix', () => {
        expect(startsWithAny('  console.log()', ['console.', 'debugger'])).toBe(true);
        expect(startsWithAny('alert()', ['console.', 'debugger'])).toBe(false);
      });
    });

    describe('endsWithAny (deprecated)', () => {
      it('checks if trimmed line ends with any suffix', () => {
        expect(endsWithAny('console.log();', [';', ')'])).toBe(true);
        expect(endsWithAny('const x = {', [';', ')'])).toBe(false);
      });
    });
  });
});
