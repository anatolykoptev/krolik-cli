/**
 * @module tests/commands/fix/fixers/equality.test
 * @description Tests for AST-based equality fixer
 */

import { describe, expect, it } from 'vitest';
import { equalityFixer } from '../../../../../src/commands/fix/fixers/equality';
import { createTestIssue } from '../../../../helpers/fix-helpers';

describe('equalityFixer', () => {
  describe('metadata', () => {
    it('has correct metadata', () => {
      expect(equalityFixer.metadata.id).toBe('equality');
      expect(equalityFixer.metadata.name).toBe('Strict Equality');
      expect(equalityFixer.metadata.category).toBe('type-safety');
      expect(equalityFixer.metadata.difficulty).toBe('safe');
      expect(equalityFixer.metadata.cliFlag).toBe('--fix-equality');
    });
  });

  describe('analyze()', () => {
    it('detects == operator', () => {
      const content = 'if (a == b) {}';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        file: 'test.ts',
        line: 1,
        severity: 'warning',
        category: 'type-safety',
        fixerId: 'equality',
      });
      expect(issues[0]?.message).toContain('==');
    });

    it('detects != operator', () => {
      const content = 'if (a != b) {}';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]?.message).toContain('!=');
    });

    it('ignores === operator', () => {
      const content = 'if (a === b) {}';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores !== operator', () => {
      const content = 'if (a !== b) {}';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('detects multiple loose equality operators', () => {
      const content = `
if (a == b) {}
if (c != d) {}
if (e == f) {}
      `.trim();
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(3);
    });

    it('ignores == inside strings', () => {
      const content = 'const msg = "use == for equality";';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores == inside template literals', () => {
      const content = 'const msg = `a == b is ${result}`;';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores == inside comments', () => {
      const content = '// use == for loose comparison';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores == inside multi-line comments', () => {
      const content = `
/*
 * a == b is bad
 */
      `.trim();
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('handles comparison in ternary', () => {
      const content = 'const result = a == b ? 1 : 0;';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
    });

    it('handles comparison in return statement', () => {
      const content = 'return x == null;';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
    });

    it('handles null comparison', () => {
      const content = 'if (x == null) {}';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
    });

    it('handles undefined comparison', () => {
      const content = 'if (x == undefined) {}';
      const issues = equalityFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
    });
  });

  describe('fix()', () => {
    it('replaces == with ===', () => {
      const content = 'if (a == b) {}';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        fixerId: 'equality',
      });

      const fix = equalityFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('replace-line');
      expect(fix?.newCode).toBe('if (a === b) {}');
    });

    it('replaces != with !==', () => {
      const content = 'if (a != b) {}';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        fixerId: 'equality',
      });

      const fix = equalityFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('replace-line');
      expect(fix?.newCode).toBe('if (a !== b) {}');
    });

    it('handles spacing around operator', () => {
      const content = 'if (a==b) {}';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        fixerId: 'equality',
      });

      const fix = equalityFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.newCode).toBe('if (a===b) {}');
    });

    it('returns null for invalid line', () => {
      const content = 'if (a == b) {}';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 999,
        fixerId: 'equality',
      });

      const fix = equalityFixer.fix(issue, content);

      expect(fix).toBeNull();
    });

    it('returns null when line is missing', () => {
      const content = 'if (a == b) {}';
      const issue = {
        file: 'test.ts',
        severity: 'warning' as const,
        category: 'type-safety' as const,
        message: 'loose equality',
      };

      const fix = equalityFixer.fix(issue, content);

      expect(fix).toBeNull();
    });

    it('handles multiple operators on same line', () => {
      const content = 'if (a == b && c == d) {}';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        fixerId: 'equality',
      });

      const fix = equalityFixer.fix(issue, content);

      // Should fix all operators on the line
      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('replace-line');
      expect(fix?.newCode).toBe('if (a === b && c === d) {}');
    });
  });

  describe('shouldSkip()', () => {
    it('skips test files', () => {
      const issue = createTestIssue({
        file: 'src/utils.test.ts',
        line: 1,
        fixerId: 'equality',
      });

      const shouldSkip = equalityFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(true);
    });

    it('skips spec files', () => {
      const issue = createTestIssue({
        file: 'src/utils.spec.ts',
        line: 1,
        fixerId: 'equality',
      });

      const shouldSkip = equalityFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(true);
    });

    it('skips __tests__ directory', () => {
      const issue = createTestIssue({
        file: 'src/__tests__/utils.ts',
        line: 1,
        fixerId: 'equality',
      });

      const shouldSkip = equalityFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(true);
    });

    it('does not skip regular source files', () => {
      const issue = createTestIssue({
        file: 'src/utils/compare.ts',
        line: 1,
        fixerId: 'equality',
      });

      const shouldSkip = equalityFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(false);
    });
  });
});
