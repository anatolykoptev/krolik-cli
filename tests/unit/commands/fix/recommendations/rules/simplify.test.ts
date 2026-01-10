/**
 * @module tests/unit/commands/fix/recommendations/rules/simplify
 * @description Unit tests for simplify recommendations (AST-based)
 */

import { describe, expect, it } from 'vitest';
import type { FileAnalysis } from '../../../../../../src/commands/fix/core';
import { SIMPLIFY_RULES } from '../../../../../../src/commands/fix/recommendations/rules/simplify';

const createMockAnalysis = (overrides: Partial<FileAnalysis> = {}): FileAnalysis => ({
  path: '/test/file.ts',
  relativePath: 'file.ts',
  lines: 100,
  blankLines: 10,
  commentLines: 5,
  codeLines: 85,
  functions: [],
  exports: 1,
  imports: 0,
  fileType: 'util',
  issues: [],
  ...overrides,
});

describe('SIMPLIFY_RULES', () => {
  it('should have 12 rules defined', () => {
    expect(SIMPLIFY_RULES.length).toBe(12);
  });

  it('should all have category "simplify"', () => {
    for (const rule of SIMPLIFY_RULES) {
      expect(rule.category).toBe('simplify');
    }
  });

  describe('simplify-verbose-conditionals', () => {
    const rule = SIMPLIFY_RULES.find((r) => r.id === 'simplify-verbose-conditionals')!;

    it('should detect verbose if-else chains with returns', () => {
      const content = `
function getLabel(status) {
  if (status === 'A') {
    return 'Alpha';
  } else if (status === 'B') {
    return 'Beta';
  } else if (status === 'C') {
    return 'Gamma';
  } else {
    return 'Unknown';
  }
}`;
      expect(rule.check!(content, createMockAnalysis())).toBe(true);
    });

    it('should not flag simple conditionals', () => {
      const content = `
function check(val) {
  if (val > 0) return true;
  return false;
}`;
      expect(rule.check!(content, createMockAnalysis())).toBe(false);
    });
  });

  describe('simplify-redundant-boolean', () => {
    const rule = SIMPLIFY_RULES.find((r) => r.id === 'simplify-redundant-boolean')!;

    it('should detect === true', () => {
      // Wrap in function for valid AST
      const content = `function test() { if (isValid === true) { doSomething(); } }`;
      const result = rule.check!(content, createMockAnalysis());
      expect(result).toMatchObject({ detected: true });
    });

    it('should detect ternary returning booleans', () => {
      // Wrap in function for valid AST
      const content = `function test(isValid) { return isValid ? true : false; }`;
      const result = rule.check!(content, createMockAnalysis());
      expect(result).toMatchObject({ detected: true });
    });

    it('should not flag normal boolean usage', () => {
      const content = `function test(isValid, data) { if (isValid) { return data; } }`;
      expect(rule.check!(content, createMockAnalysis())).toBe(false);
    });
  });

  describe('simplify-unnecessary-else', () => {
    const rule = SIMPLIFY_RULES.find((r) => r.id === 'simplify-unnecessary-else')!;

    it('should detect else after return', () => {
      // Wrap in function for valid AST
      const content = `
function test(data) {
  if (!data) {
    return null;
  } else {
    return data.value;
  }
}`;
      expect(rule.check!(content, createMockAnalysis())).toBe(true);
    });

    it('should not flag necessary else', () => {
      const content = `
function test(condition) {
  let x;
  if (condition) {
    x = 1;
  } else {
    x = 2;
  }
  return x;
}`;
      expect(rule.check!(content, createMockAnalysis())).toBe(false);
    });
  });

  describe('simplify-object-shorthand', () => {
    const rule = SIMPLIFY_RULES.find((r) => r.id === 'simplify-object-shorthand')!;

    it('should detect { key: key } patterns', () => {
      const content = `const name = 'test'; const age = 30; const obj = { name: name, age: age };`;
      expect(rule.check!(content, createMockAnalysis())).toBe(true);
    });

    it('should not flag mixed shorthand', () => {
      const content = `const name = 'test'; const obj = { name, age: 30 };`;
      expect(rule.check!(content, createMockAnalysis())).toBe(false);
    });
  });

  describe('simplify-string-concat', () => {
    const rule = SIMPLIFY_RULES.find((r) => r.id === 'simplify-string-concat')!;

    it('should detect string concatenation', () => {
      const content = `const name = 'world'; const msg = 'Hello, ' + name + '!';`;
      expect(rule.check!(content, createMockAnalysis())).toBe(true);
    });

    it('should not flag template literals', () => {
      const content = `const name = 'world'; const msg = \`Hello, \${name}!\`;`;
      expect(rule.check!(content, createMockAnalysis())).toBe(false);
    });
  });

  describe('simplify-negation-chain', () => {
    const rule = SIMPLIFY_RULES.find((r) => r.id === 'simplify-negation-chain')!;

    it('should detect double negation', () => {
      const content = `const value = 1; const isActive = !!value;`;
      // Now uses check function instead of pattern
      expect(rule.check!(content, createMockAnalysis())).toBe(true);
    });
  });

  describe('simplify-empty-functions', () => {
    const rule = SIMPLIFY_RULES.find((r) => r.id === 'simplify-empty-functions')!;

    it('should detect multiple empty functions', () => {
      const content = `
const a = () => {};
const b = () => {};
const c = () => {};`;
      expect(rule.check!(content, createMockAnalysis())).toBe(true);
    });

    it('should not flag single empty function', () => {
      const content = 'const noop = () => {};';
      expect(rule.check!(content, createMockAnalysis())).toBe(false);
    });
  });

  describe('simplify-callback-hell', () => {
    const rule = SIMPLIFY_RULES.find((r) => r.id === 'simplify-callback-hell')!;

    it('should detect nested callbacks', () => {
      const content = `
getData((data) => {
  processData(data, (result) => {
    saveData(result, (saved) => {
      console.log(saved);
    });
  });
});`;
      expect(rule.check!(content, createMockAnalysis())).toBe(true);
    });

    it('should not flag flat async code', () => {
      const content = `
async function main() {
  const data = await getData();
  const result = await processData(data);
  await saveData(result);
}`;
      expect(rule.check!(content, createMockAnalysis())).toBe(false);
    });
  });
});
