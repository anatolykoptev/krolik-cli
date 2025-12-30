/**
 * @module tests/commands/fix/fixers/duplicate.test
 * @description Tests for duplicate function fixer
 */

import { describe, expect, it } from 'vitest';
import type { QualityIssue } from '../../../../../src/commands/fix/core/types';
import { duplicateFixer, metadata } from '../../../../../src/commands/fix/fixers/duplicate';

describe('duplicate fixer', () => {
  describe('metadata', () => {
    it('has correct id', () => {
      expect(metadata.id).toBe('duplicate');
    });

    it('has correct name', () => {
      expect(metadata.name).toBe('Duplicate Functions');
    });

    it('has correct category', () => {
      expect(metadata.category).toBe('lint');
    });

    it('has safe difficulty', () => {
      expect(metadata.difficulty).toBe('risky');
    });

    it('has correct CLI flag', () => {
      expect(metadata.cliFlag).toBe('--fix-duplicate');
    });

    it('has relevant tags', () => {
      expect(metadata.tags).toContain('safe');
      expect(metadata.tags).toContain('refactoring');
      expect(metadata.tags).toContain('deduplication');
    });
  });

  describe('analyze()', () => {
    it('returns empty array (analysis done by refactor)', () => {
      const content = `
        function foo() { return 1; }
        function bar() { return 1; }
      `;

      const issues = duplicateFixer.analyze(content, 'test.ts');

      expect(issues).toEqual([]);
    });
  });

  describe('fix()', () => {
    it('returns null for non-duplicate issue', () => {
      const issue: QualityIssue = {
        file: 'src/test.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Some other issue',
        fixerId: 'duplicate',
      };

      const operation = duplicateFixer.fix(issue, '');

      expect(operation).toBeNull();
    });

    it('returns null when no affected files in snippet', () => {
      const issue: QualityIssue = {
        file: 'src/test.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Merge duplicate function: formatDate',
        fixerId: 'duplicate',
        snippet: 'No affected files here',
      };

      const operation = duplicateFixer.fix(issue, '');

      expect(operation).toBeNull();
    });

    it('returns null when only one affected file', () => {
      const issue: QualityIssue = {
        file: 'src/test.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Merge duplicate function: formatDate',
        fixerId: 'duplicate',
        snippet: `Affected files:
  - src/utils.ts`,
      };

      const operation = duplicateFixer.fix(issue, '');

      expect(operation).toBeNull();
    });

    it('returns fix operation for valid duplicate issue', () => {
      const issue: QualityIssue = {
        file: 'src/utils/format.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Merge duplicate function: formatDate',
        fixerId: 'duplicate',
        snippet: `Affected files:
  - src/utils/format.ts
  - src/helpers/date.ts`,
      };

      const operation = duplicateFixer.fix(issue, '');

      expect(operation).not.toBeNull();
      expect(operation?.action).toBe('replace-range');
      expect(operation?.file).toBe('src/utils/format.ts');
    });

    it('extracts function name from message', () => {
      const issue: QualityIssue = {
        file: 'src/test.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Merge duplicate function: myFunction',
        fixerId: 'duplicate',
        snippet: `Affected files:
  - src/a.ts
  - src/b.ts`,
      };

      const operation = duplicateFixer.fix(issue, '');

      expect(operation).not.toBeNull();
      // @ts-expect-error - accessing internal _meta
      expect(operation?._meta?.functionName).toBe('myFunction');
    });

    it('identifies canonical and duplicate files', () => {
      const issue: QualityIssue = {
        file: 'src/canonical.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Merge duplicate function: test',
        fixerId: 'duplicate',
        snippet: `Affected files:
  - src/canonical.ts
  - src/duplicate1.ts
  - src/duplicate2.ts`,
      };

      const operation = duplicateFixer.fix(issue, '');

      expect(operation).not.toBeNull();
      // @ts-expect-error - accessing internal _meta
      expect(operation?._meta?.canonicalFile).toBe('src/canonical.ts');
      // @ts-expect-error - accessing internal _meta
      expect(operation?._meta?.duplicateFiles).toEqual(['src/duplicate1.ts', 'src/duplicate2.ts']);
    });
  });

  describe('shouldSkip()', () => {
    const shouldSkip = duplicateFixer.shouldSkip!;

    it('skips node_modules files', () => {
      const issue: QualityIssue = {
        file: 'node_modules/lodash/index.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Merge duplicate',
        snippet: 'Affected files:\n  - a.ts\n  - b.ts',
      };

      expect(shouldSkip(issue, '')).toBe(true);
    });

    it('skips test files', () => {
      const testFile: QualityIssue = {
        file: 'src/utils.test.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Merge duplicate',
        snippet: 'Affected files:\n  - a.ts\n  - b.ts',
      };

      const specFile: QualityIssue = {
        file: 'src/utils.spec.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Merge duplicate',
        snippet: 'Affected files:\n  - a.ts\n  - b.ts',
      };

      expect(shouldSkip(testFile, '')).toBe(true);
      expect(shouldSkip(specFile, '')).toBe(true);
    });

    it('skips issues without affected files context', () => {
      const issue: QualityIssue = {
        file: 'src/utils.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Merge duplicate',
        snippet: 'Some other snippet without affected files',
      };

      expect(shouldSkip(issue, '')).toBe(true);
    });

    it('does not skip valid issues', () => {
      const issue: QualityIssue = {
        file: 'src/utils.ts',
        severity: 'warning',
        category: 'lint',
        message: 'Merge duplicate',
        snippet: 'Affected files:\n  - src/a.ts\n  - src/b.ts',
      };

      expect(shouldSkip(issue, '')).toBe(false);
    });
  });
});
