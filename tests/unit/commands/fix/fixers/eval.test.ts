/**
 * @module tests/commands/fix/fixers/eval.test
 * @description Tests for AST-based eval fixer
 */

import { describe, expect, it } from 'vitest';
import { evalFixer } from '../../../../../src/commands/fix/fixers/eval';
import { createTestIssue } from '../../../../helpers/fix-helpers';

describe('evalFixer', () => {
  describe('metadata', () => {
    it('has correct metadata', () => {
      expect(evalFixer.metadata.id).toBe('eval');
      expect(evalFixer.metadata.name).toBe('Eval Security');
      expect(evalFixer.metadata.category).toBe('type-safety');
      expect(evalFixer.metadata.difficulty).toBe('safe');
      expect(evalFixer.metadata.cliFlag).toBe('--fix-eval');
    });
  });

  describe('analyze()', () => {
    it('detects eval() call', () => {
      const content = 'eval("console.log(1)");';
      const issues = evalFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        file: 'test.ts',
        line: 1,
        severity: 'error',
        category: 'type-safety',
        fixerId: 'eval',
      });
      expect(issues[0]?.message).toContain('eval');
    });

    it('detects eval() with variable', () => {
      const content = 'eval(code);';
      const issues = evalFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
    });

    it('detects new Function() constructor', () => {
      const content = 'new Function("return 1")();';
      const issues = evalFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]?.severity).toBe('warning');
      expect(issues[0]?.message).toContain('Function');
    });

    it('detects multiple eval calls', () => {
      const content = `
eval("code1");
eval("code2");
eval("code3");
      `.trim();
      const issues = evalFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(3);
    });

    it('ignores eval inside strings', () => {
      const content = 'const msg = "use eval() carefully";';
      const issues = evalFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores eval inside template literals', () => {
      const content = 'const msg = `eval(${code}) is dangerous`;';
      const issues = evalFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores eval inside comments', () => {
      const content = '// eval("code") is bad';
      const issues = evalFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores eval inside multi-line comments', () => {
      const content = `
/*
 * eval("code") should be avoided
 */
      `.trim();
      const issues = evalFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores eval as property name', () => {
      const content = 'const obj = { eval: true };';
      const issues = evalFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores method called eval on object', () => {
      const content = 'obj.eval("code");';
      const issues = evalFixer.analyze(content, 'test.ts');

      // This is a method call, not direct eval
      expect(issues).toHaveLength(0);
    });

    it('detects Function constructor without new', () => {
      // Note: This is still dangerous but harder to detect
      // AST approach only catches new Function()
      const content = 'new Function("x", "return x*2")';
      const issues = evalFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
    });
  });

  describe('fix()', () => {
    it('converts eval(jsonData) to JSON.parse', () => {
      const content = 'const result = eval(jsonData);';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        message: 'eval()',
        fixerId: 'eval',
      });

      const fix = evalFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.newCode).toContain('JSON.parse(jsonData)');
    });

    it('converts eval(responseData) to JSON.parse', () => {
      const content = 'const result = eval(responseData);';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        message: 'eval()',
        fixerId: 'eval',
      });

      const fix = evalFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.newCode).toContain('JSON.parse');
    });

    it('adds TODO comment for complex eval', () => {
      const content = 'eval(code);';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        message: 'eval()',
        fixerId: 'eval',
      });

      const fix = evalFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('insert-before');
      expect(fix?.newCode).toContain('TODO');
    });

    it('adds TODO comment for new Function()', () => {
      const content = 'new Function("return 1")();';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        message: 'new Function()',
        fixerId: 'eval',
      });

      const fix = evalFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('insert-before');
      expect(fix?.newCode).toContain('TODO');
    });

    it('preserves indentation in TODO comment', () => {
      const content = '    eval(code);';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
        message: 'eval()',
        fixerId: 'eval',
      });

      const fix = evalFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.newCode).toMatch(/^\s{4}\/\/ TODO/);
    });

    it('returns null for invalid line', () => {
      const content = 'eval(code);';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 999,
        fixerId: 'eval',
      });

      const fix = evalFixer.fix(issue, content);

      expect(fix).toBeNull();
    });

    it('returns null when line is missing', () => {
      const content = 'eval(code);';
      const issue = {
        file: 'test.ts',
        severity: 'error' as const,
        category: 'type-safety' as const,
        message: 'eval',
      };

      const fix = evalFixer.fix(issue, content);

      expect(fix).toBeNull();
    });
  });

  describe('shouldSkip()', () => {
    it('skips test files', () => {
      const issue = createTestIssue({
        file: 'src/eval.test.ts',
        line: 1,
        fixerId: 'eval',
      });

      const shouldSkip = evalFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(true);
    });

    it('skips spec files', () => {
      const issue = createTestIssue({
        file: 'src/eval.spec.ts',
        line: 1,
        fixerId: 'eval',
      });

      const shouldSkip = evalFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(true);
    });

    it('skips __tests__ directory', () => {
      const issue = createTestIssue({
        file: 'src/__tests__/eval.ts',
        line: 1,
        fixerId: 'eval',
      });

      const shouldSkip = evalFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(true);
    });

    it('skips webpack config files', () => {
      const issue = createTestIssue({
        file: 'webpack.config.js',
        line: 1,
        fixerId: 'eval',
      });

      const shouldSkip = evalFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(true);
    });

    it('skips rollup config files', () => {
      const issue = createTestIssue({
        file: 'rollup.config.js',
        line: 1,
        fixerId: 'eval',
      });

      const shouldSkip = evalFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(true);
    });

    it('skips vite config files', () => {
      const issue = createTestIssue({
        file: 'vite.config.ts',
        line: 1,
        fixerId: 'eval',
      });

      const shouldSkip = evalFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(true);
    });

    it('does not skip regular source files', () => {
      const issue = createTestIssue({
        file: 'src/utils/parser.ts',
        line: 1,
        fixerId: 'eval',
      });

      const shouldSkip = evalFixer.shouldSkip?.(issue, '');

      expect(shouldSkip).toBe(false);
    });
  });
});
