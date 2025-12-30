/**
 * @module tests/commands/fix/fixers/debugger.test
 * @description Tests for debugger fixer
 */

import { describe, expect, it } from 'vitest';
import { debuggerFixer } from '../../../../../src/commands/fix/fixers/debugger';
import { createTestIssue } from '../../../../helpers/fix-helpers';

describe('debuggerFixer', () => {
  describe('metadata', () => {
    it('has correct metadata', () => {
      expect(debuggerFixer.metadata.id).toBe('debugger');
      expect(debuggerFixer.metadata.name).toBe('Debugger Statements');
      expect(debuggerFixer.metadata.category).toBe('lint');
      expect(debuggerFixer.metadata.difficulty).toBe('risky');
      expect(debuggerFixer.metadata.cliFlag).toBe('--fix-debugger');
      expect(debuggerFixer.metadata.negateFlag).toBe('--no-debugger');
    });
  });

  describe('analyze()', () => {
    it('detects standalone debugger statement', () => {
      const content = 'debugger;';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        file: 'test.ts',
        line: 1,
        severity: 'warning',
        category: 'lint',
        fixerId: 'debugger',
      });
      expect(issues[0]?.message).toContain('debugger');
    });

    it('detects debugger without semicolon', () => {
      const content = 'debugger';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
    });

    it('detects debugger with whitespace', () => {
      const content = '  debugger  ;  ';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
    });

    it('detects debugger in function body', () => {
      const content = `
function test() {
  debugger;
  return true;
}
      `.trim();
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]?.line).toBe(2);
    });

    it('detects multiple debugger statements', () => {
      const content = `
debugger;
const x = 1;
debugger;
      `.trim();
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(2);
      expect(issues[0]?.line).toBe(1);
      expect(issues[1]?.line).toBe(3);
    });

    it('ignores debugger in strings', () => {
      const content = 'const msg = "use debugger to debug";';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores debugger in template literals', () => {
      const content = 'const msg = `avoid debugger statements`;';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores debugger in single-line comments', () => {
      const content = '// debugger; // commented out';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores debugger in multi-line comments', () => {
      const content = `
/*
 * debugger statement here
 */
      `.trim();
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores debugger in JSDoc', () => {
      const content = `
/**
 * Don't use debugger in production
 */
      `.trim();
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(0);
    });

    it('ignores debugger as property name', () => {
      const content = 'const options = { debugger: true };';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      // Should not detect - property name, not statement
      expect(issues).toHaveLength(0);
    });

    it('ignores debugger in identifier names', () => {
      const content = 'const myDebugger = createDebugger();';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      // Should not detect - part of identifier
      expect(issues).toHaveLength(0);
    });

    it('ignores debugger in property access', () => {
      const content = 'options.debugger = false;';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      // Should not detect - property access
      expect(issues).toHaveLength(0);
    });

    it('detects debugger in if block', () => {
      const content = `
if (condition) {
  debugger;
}
      `.trim();
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]?.line).toBe(2);
    });

    it('detects debugger in try-catch', () => {
      const content = `
try {
  debugger;
} catch (e) {
  debugger;
}
      `.trim();
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(2);
    });

    it('sets correct snippet', () => {
      const content = 'debugger; // this is a debugging statement';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues[0]?.snippet).toBeDefined();
      expect(issues[0]?.snippet?.length).toBeLessThanOrEqual(60);
    });

    it('handles inline debugger (multiple statements on one line)', () => {
      const content = 'const x = 1; debugger; return x;';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]?.line).toBe(1);
    });
  });

  describe('fix()', () => {
    it('returns delete-line operation for standalone debugger', () => {
      const content = 'debugger;';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
      });

      const fix = debuggerFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('delete-line');
      expect(fix?.line).toBe(1);
      expect(fix?.oldCode).toBe('debugger;');
    });

    it('deletes debugger without semicolon', () => {
      const content = 'debugger';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
      });

      const fix = debuggerFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('delete-line');
    });

    it('deletes indented debugger', () => {
      const content = '    debugger;';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
      });

      const fix = debuggerFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('delete-line');
    });

    it('returns replace-line for inline debugger', () => {
      const content = 'const x = 1; debugger; return x;';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
      });

      const fix = debuggerFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('replace-line');
      expect(fix?.newCode).toBe('const x = 1;  return x;');
      expect(fix?.oldCode).toBe('const x = 1; debugger; return x;');
    });

    it('replaces debugger with semicolon in inline statement', () => {
      const content = 'if (x) debugger;';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
      });

      const fix = debuggerFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('replace-line');
      expect(fix?.newCode?.trim()).toBe('if (x)');
    });

    it('handles multiple debuggers on same line', () => {
      const content = 'debugger; debugger;';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 1,
      });

      const fix = debuggerFixer.fix(issue, content);

      // Should still process it (even though unusual)
      expect(fix).not.toBeNull();
    });

    it('returns null for invalid line number', () => {
      const content = 'debugger;';
      const issue = createTestIssue({
        file: 'test.ts',
        line: 999,
      });

      const fix = debuggerFixer.fix(issue, content);

      expect(fix).toBeNull();
    });

    it('returns null when line is missing', () => {
      const content = 'debugger;';
      // Don't use createTestIssue because it defaults line to 1
      const issue = {
        file: 'test.ts',
        severity: 'warning' as const,
        category: 'lint' as const,
        message: 'debugger found',
        // line is undefined
      };

      const fix = debuggerFixer.fix(issue, content);

      expect(fix).toBeNull();
    });

    it('returns null when file is missing', () => {
      const content = 'debugger;';
      const issue = {
        file: '', // Empty file path
        line: 1,
        severity: 'warning' as const,
        category: 'lint' as const,
        message: 'debugger found',
      };

      const fix = debuggerFixer.fix(issue, content);

      expect(fix).toBeNull();
    });

    it('includes file path in operation', () => {
      const content = 'debugger;';
      const issue = createTestIssue({
        file: 'src/test.ts',
        line: 1,
      });

      const fix = debuggerFixer.fix(issue, content);

      expect(fix?.file).toBe('src/test.ts');
    });

    it('handles debugger in complex function', () => {
      const content = `
function complexFunc() {
  debugger;
}
      `.trim();
      const issue = createTestIssue({
        file: 'test.ts',
        line: 2,
      });

      const fix = debuggerFixer.fix(issue, content);

      expect(fix).not.toBeNull();
      expect(fix?.action).toBe('delete-line');
      expect(fix?.line).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty file', () => {
      const content = '';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toEqual([]);
    });

    it('handles file with only comments', () => {
      const content = `
// Just comments
/* More comments */
      `.trim();
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toEqual([]);
    });

    it('handles file with only whitespace', () => {
      const content = '   \n  \n   ';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toEqual([]);
    });

    it('handles debugger at EOF without newline', () => {
      const content = 'const x = 1;\ndebugger';
      const issues = debuggerFixer.analyze(content, 'test.ts');

      expect(issues).toHaveLength(1);
      expect(issues[0]?.line).toBe(2);
    });

    it('handles very long lines', () => {
      const longLine = `const x = ${'1 + '.repeat(100)}1; debugger;`;
      const issues = debuggerFixer.analyze(longLine, 'test.ts');

      expect(issues).toHaveLength(1);
    });
  });
});
