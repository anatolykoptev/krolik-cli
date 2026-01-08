/**
 * @module tests/commands/fix/fixers/any-type.test
 * @description Tests for AST-based any-type fixer
 */

import { describe, expect, it } from 'vitest';
import { anyTypeFixer } from '../../../../../src/commands/fix/fixers/any-type';
import { createTestIssue } from '../../../../helpers/fix-helpers';

describe('anyTypeFixer', () => {
  describe('metadata', () => {
    it('has correct metadata', () => {
      expect(anyTypeFixer.metadata.id).toBe('any-type');
      expect(anyTypeFixer.metadata.name).toBe('Any Type Usage');
      expect(anyTypeFixer.metadata.category).toBe('type-safety');
      expect(anyTypeFixer.metadata.difficulty).toBe('safe');
      expect(anyTypeFixer.metadata.cliFlag).toBe('--fix-any');
    });
  });

  describe('analyze()', () => {
    it('detects any type annotation', () => {
      const content = 'const x: any = 1;';
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        file: 'test.ts',
        line: 1,
        severity: 'warning',
        category: 'type-safety',
        fixerId: 'any-type',
      });
      expect(issues[0]?.message).toContain('any');
    });

    it('detects any in function parameter', () => {
      const content = 'function test(x: any) {}';
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]?.line).toBe(1);
    });

    it('detects any in return type', () => {
      const content = 'function test(): any { return null; }';
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
    });

    it('detects any as type assertion', () => {
      const content = 'const x = value as any;';
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]?.message).toContain('type assertion');
    });

    it('detects any in generic parameter', () => {
      const content = 'const arr: Array<any> = [];';
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]?.message).toContain('generic parameter');
    });

    it('detects multiple any types', () => {
      const content = `
const x: any = 1;
const y: any = 2;
const z: any = 3;
      `.trim();
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(3);
      expect(issues[0]?.line).toBe(1);
      expect(issues[1]?.line).toBe(2);
      expect(issues[2]?.line).toBe(3);
    });

    it('ignores any inside strings', () => {
      const content = 'const msg = "any type is bad";';
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores any inside template literals', () => {
      const content = 'const msg = `any value`;';
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores any inside comments', () => {
      const content = '// use any for flexibility';
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores any in plain comments (not JSDoc type annotations)', () => {
      // JSDoc type annotations like @param {any} ARE detected because ts-morph
      // parses them as actual type annotations. Only plain comments are ignored.
      const content = `
// We should avoid using any type here
/* any is not recommended */
function test(x: string) {}
      `.trim();
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores any as part of identifier (company, many)', () => {
      const content = 'const company = "Acme";';
      const issues = anyTypeFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('skips .d.ts files', () => {
      const content = 'declare const x: any;';
      const issues = anyTypeFixer.analyze(content, 'types.d.ts');

      expect(issues).toHaveLength(0);
    });

    it('skips test files', () => {
      const content = 'const x: any = 1;';
      const issues = anyTypeFixer.analyze(content, 'test.test.ts');

      expect(issues).toHaveLength(0);
    });

    it('skips non-TypeScript files', () => {
      const content = 'const x: any = 1;';
      const issues = anyTypeFixer.analyze(content, 'test.js');

      expect(issues).toHaveLength(0);
    });
  });

  describe('fix()', () => {
    it('replaces any with unknown in type annotation', () => {
      const content = 'const x: any = 1;';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        fixerId: 'any-type',
      });

      const fix = anyTypeFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('replace-line');
      expect(fix?.newCode).toBe('const x: unknown = 1;');
    });

    it('replaces any with unknown in function parameter', () => {
      const content = 'function test(x: any) {}';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        fixerId: 'any-type',
      });

      const fix = anyTypeFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('replace-line');
      expect(fix?.newCode).toBe('function test(x: unknown) {}');
    });

    it('replaces any in generic parameter', () => {
      const content = 'const arr: Array<any> = [];';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        fixerId: 'any-type',
      });

      const fix = anyTypeFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('replace-line');
      expect(fix?.newCode).toBe('const arr: Array<unknown> = [];');
    });

    it('returns null for invalid line', () => {
      const content = 'const x: any = 1;';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 999,
        fixerId: 'any-type',
      });

      const fix = anyTypeFixer.fix(issue, content);

      expect(fix).toBeNull();
    });

    it('returns null when line is missing', () => {
      const content = 'const x: any = 1;';
      const issue = {
        file: 'test.ts',
        severity: 'warning' as const,
        category: 'type-safety' as const,
        message: 'any type',
      };

      const fix = anyTypeFixer.fix(issue, content);

      expect(fix).toBeNull();
    });

    it('handles multiple any on same line', () => {
      const content = 'function test(a: any, b: any): any {}';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        fixerId: 'any-type',
      });

      const fix = anyTypeFixer.fix(issue, content);

      // Should fix all any on the line
      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('replace-line');
      expect(fix?.newCode).toBe('function test(a: unknown, b: unknown): unknown {}');
    });
  });
});
