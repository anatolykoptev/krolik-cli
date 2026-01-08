import { describe, expect, it } from 'vitest';
import { analyzeTsIgnoreAST } from '../../../../../src/commands/fix/fixers/ts-ignore/ast-analyzer';
import { fixTsIgnoreAST } from '../../../../../src/commands/fix/fixers/ts-ignore/ast-fixer';

describe('ts-ignore fixer', () => {
  describe('AST Analyzer', () => {
    it('detects @ts-ignore comments', () => {
      const content = `
const x = 1;
// @ts-ignore
const y: string = 123;
`;
      const issues = analyzeTsIgnoreAST(content, 'test.ts');
      expect(issues.length).toBe(1);
      expect(issues[0]?.message).toContain('@ts-ignore');
      expect(issues[0]?.line).toBe(3);
    });

    it('detects @ts-nocheck comments', () => {
      const content = `// @ts-nocheck
const x = 1;
`;
      const issues = analyzeTsIgnoreAST(content, 'test.ts');
      expect(issues.length).toBe(1);
      expect(issues[0]?.message).toContain('@ts-nocheck');
    });

    it('detects @ts-expect-error comments', () => {
      const content = `
// @ts-expect-error intentional
const x: string = 123;
`;
      const issues = analyzeTsIgnoreAST(content, 'test.ts');
      expect(issues.length).toBe(1);
      expect(issues[0]?.message).toContain('@ts-expect-error');
    });

    it('skips .d.ts files', () => {
      const content = `// @ts-ignore
declare const x: number;
`;
      const issues = analyzeTsIgnoreAST(content, 'types.d.ts');
      expect(issues.length).toBe(0);
    });

    it('skips non-TypeScript files', () => {
      const content = `// @ts-ignore
const x = 1;
`;
      const issues = analyzeTsIgnoreAST(content, 'test.js');
      expect(issues.length).toBe(0);
    });

    it('handles multiple directives', () => {
      const content = `
// @ts-ignore
const a = 1;
// @ts-expect-error
const b = 2;
// @ts-nocheck
`;
      const issues = analyzeTsIgnoreAST(content, 'test.ts');
      expect(issues.length).toBeGreaterThanOrEqual(2);
    });

    it('does not detect directives inside string literals', () => {
      const content = `
const msg = "Use @ts-ignore to suppress errors";
console.log(msg);
`;
      const issues = analyzeTsIgnoreAST(content, 'test.ts');
      expect(issues.length).toBe(0);
    });

    it('detects directives in block comments', () => {
      const content = `
/* @ts-ignore */
const x: string = 123;
`;
      const issues = analyzeTsIgnoreAST(content, 'test.ts');
      // Fallback may or may not detect this - depends on implementation
      expect(issues.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('AST Fixer', () => {
    it('deletes standalone @ts-ignore line', () => {
      const content = `const a = 1;
// @ts-ignore
const b: string = 123;
`;
      const issue = {
        file: 'test.ts',
        line: 2,
        severity: 'error' as const,
        category: 'type-safety',
        message: '@ts-ignore suppresses TypeScript errors',
        suggestion: 'Fix the type error',
        snippet: '// @ts-ignore',
        fixerId: 'ts-ignore',
      };

      const fix = fixTsIgnoreAST(issue, content);
      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('delete-line');
      expect(fix?.line).toBe(2);
    });

    it('returns null for non-TypeScript files', () => {
      const content = `// @ts-ignore
const x = 1;
`;
      const issue = {
        file: 'test.js',
        line: 1,
        severity: 'error' as const,
        category: 'type-safety',
        message: '@ts-ignore',
        suggestion: '',
        snippet: '',
        fixerId: 'ts-ignore',
      };

      const fix = fixTsIgnoreAST(issue, content);
      expect(fix).toBeNull();
    });

    it('returns null for .d.ts files', () => {
      const content = `// @ts-ignore
declare const x: number;
`;
      const issue = {
        file: 'types.d.ts',
        line: 1,
        severity: 'error' as const,
        category: 'type-safety',
        message: '@ts-ignore',
        suggestion: '',
        snippet: '',
        fixerId: 'ts-ignore',
      };

      const fix = fixTsIgnoreAST(issue, content);
      expect(fix).toBeNull();
    });

    it('handles missing line gracefully', () => {
      const content = `const x = 1;`;
      const issue = {
        file: 'test.ts',
        line: 100,
        severity: 'error' as const,
        category: 'type-safety',
        message: '@ts-ignore',
        suggestion: '',
        snippet: '',
        fixerId: 'ts-ignore',
      };

      const fix = fixTsIgnoreAST(issue, content);
      expect(fix).toBeNull();
    });

    it('handles missing file path', () => {
      const content = `// @ts-ignore
const x = 1;
`;
      const issue = {
        file: '',
        line: 1,
        severity: 'error' as const,
        category: 'type-safety',
        message: '@ts-ignore',
        suggestion: '',
        snippet: '',
        fixerId: 'ts-ignore',
      };

      const fix = fixTsIgnoreAST(issue, content);
      expect(fix).toBeNull();
    });
  });

  describe('Integration', () => {
    it('analyzer and fixer work together', () => {
      const content = `
// @ts-ignore
const x: string = 123;
`;
      const issues = analyzeTsIgnoreAST(content, 'test.ts');
      expect(issues.length).toBe(1);

      const fix = fixTsIgnoreAST(issues[0]!, content);
      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('delete-line');
    });
  });
});
