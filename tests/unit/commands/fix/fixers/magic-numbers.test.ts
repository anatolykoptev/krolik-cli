import { describe, expect, it } from 'vitest';
import { analyzeMagicNumbersAST } from '../../../../../src/commands/fix/fixers/magic-numbers/ast-analyzer';
import { fixMagicNumberAST } from '../../../../../src/commands/fix/fixers/magic-numbers/ast-fixer';

describe('magic-numbers fixer', () => {
  describe('AST Analyzer', () => {
    it('detects magic numbers in expressions', () => {
      const content = `
function calculate(x: number) {
  return x * 42;
}
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(1);
      expect(issues[0]?.message).toContain('42');
    });

    it('skips numbers in const declarations', () => {
      const content = `
const MAX_SIZE = 100;
const TIMEOUT = 5000;
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(0);
    });

    it('skips small allowed numbers', () => {
      const content = `
function test(arr: number[]) {
  return arr[0] + arr[1] + arr[2];
}
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(0);
    });

    it('skips HTTP status codes', () => {
      const content = `
if (response.status === 200) {
  return true;
}
if (response.status === 404) {
  throw new Error('Not found');
}
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(0);
    });

    it('skips port numbers', () => {
      const content = `
const server = app.listen(3000);
const https = app.listen(443);
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(0);
    });

    it('skips enum values', () => {
      const content = `
enum Status {
  Active = 100,
  Inactive = 200,
}
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(0);
    });

    it('skips default parameter values', () => {
      const content = `
function paginate(page: number, limit = 20) {
  return { page, limit };
}
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(0);
    });

    it('skips config and test files', () => {
      const content = `
const timeout = 30000;
`;
      expect(analyzeMagicNumbersAST(content, 'jest.config.ts').length).toBe(0);
      expect(analyzeMagicNumbersAST(content, 'test.spec.ts').length).toBe(0);
      expect(analyzeMagicNumbersAST(content, 'test.test.ts').length).toBe(0);
    });

    it('skips non-TypeScript files', () => {
      const content = `
const x = 42;
`;
      const issues = analyzeMagicNumbersAST(content, 'test.js');
      expect(issues.length).toBe(0);
    });

    it('skips powers of 2', () => {
      const content = `
const buffer = new ArrayBuffer(1024);
const chunk = new Uint8Array(4096);
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(0);
    });

    it('skips common percentages', () => {
      const content = `
const half = total * 50;
const quarter = total * 25;
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(0);
    });

    it('detects truly magic numbers', () => {
      const content = `
function calculate() {
  const result = value * 1337;
  return result + 9999;
}
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(2);
    });
  });

  describe('AST Fixer', () => {
    it('generates constant with semantic name for timeout', () => {
      const content = `
function delay() {
  setTimeout(() => {}, 5000);
}
`;
      const issue = {
        file: 'test.ts',
        line: 3,
        severity: 'warning' as const,
        category: 'hardcoded',
        message: 'Hardcoded number: 5000',
        suggestion: 'Extract to a named constant',
        snippet: 'setTimeout(() => {}, 5000);',
        fixerId: 'magic-numbers',
      };

      const fix = fixMagicNumberAST(issue, content);
      expect(fix).not.toBeNull();
      expect(fix?.newCode).toContain('TIMEOUT');
      expect(fix?.newCode).toContain('5000');
    });

    it('generates constant with semantic name for size', () => {
      const content = `
function resize() {
  element.width = 800;
}
`;
      const issue = {
        file: 'test.ts',
        line: 3,
        severity: 'warning' as const,
        category: 'hardcoded',
        message: 'Hardcoded number: 800',
        suggestion: 'Extract to a named constant',
        snippet: 'element.width = 800;',
        fixerId: 'magic-numbers',
      };

      const fix = fixMagicNumberAST(issue, content);
      expect(fix).not.toBeNull();
      expect(fix?.newCode).toContain('SIZE');
    });

    it('generates constant with semantic name for max', () => {
      const content = `
function validate(items: string[]) {
  if (items.length > 50) throw new Error('Too many');
}
`;
      const issue = {
        file: 'test.ts',
        line: 3,
        severity: 'warning' as const,
        category: 'hardcoded',
        message: 'Hardcoded number: 50',
        suggestion: 'Extract to a named constant',
        snippet: 'if (items.length > 50)',
        fixerId: 'magic-numbers',
      };

      const fix = fixMagicNumberAST(issue, content);
      expect(fix).not.toBeNull();
    });

    it('returns null for non-TypeScript files', () => {
      const content = `const x = 42;`;
      const issue = {
        file: 'test.js',
        line: 1,
        severity: 'warning' as const,
        category: 'hardcoded',
        message: 'Hardcoded number: 42',
        suggestion: '',
        snippet: '',
        fixerId: 'magic-numbers',
      };

      const fix = fixMagicNumberAST(issue, content);
      expect(fix).toBeNull();
    });

    it('returns null for missing line', () => {
      const content = `const x = 1;`;
      const issue = {
        file: 'test.ts',
        line: 100,
        severity: 'warning' as const,
        category: 'hardcoded',
        message: 'Hardcoded number: 42',
        suggestion: '',
        snippet: '',
        fixerId: 'magic-numbers',
      };

      const fix = fixMagicNumberAST(issue, content);
      expect(fix).toBeNull();
    });
  });

  describe('Integration', () => {
    it('analyzer and fixer work together', () => {
      const content = `
function calculate(x: number) {
  return x * 42;
}
`;
      const issues = analyzeMagicNumbersAST(content, 'test.ts');
      expect(issues.length).toBe(1);

      const fix = fixMagicNumberAST(issues[0]!, content);
      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('replace-range');
    });
  });
});
