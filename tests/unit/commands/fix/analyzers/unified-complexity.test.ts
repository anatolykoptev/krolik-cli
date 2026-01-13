/**
 * @module tests/unit/commands/fix/analyzers/unified-complexity.test.ts
 * @description Tests for complexity detection in unified-swc analyzer
 */

import { describe, expect, it } from 'vitest';
import { analyzeFileUnified } from '../../../../../src/commands/fix/analyzers/unified-swc';

describe('analyzeFileUnified - complexity detection', () => {
  it('should extract functions with complexity metrics', async () => {
    const code = `
export function simpleFunction() {
  return 42;
}

export function withIf(a: number) {
  if (a > 0) {
    return a;
  }
  return 0;
}
`;

    const result = await analyzeFileUnified(code, 'test.ts');

    expect(result.functions.length).toBeGreaterThanOrEqual(2);

    const simpleFunc = result.functions.find((f) => f.name === 'simpleFunction');
    expect(simpleFunc).toBeDefined();
    expect(simpleFunc?.complexity).toBe(1); // Base complexity

    const withIfFunc = result.functions.find((f) => f.name === 'withIf');
    expect(withIfFunc).toBeDefined();
    expect(withIfFunc?.complexity).toBe(2); // Base + 1 for if
  });

  it('should count complexity for control flow statements', async () => {
    const code = `
export function complexFunction(a: number, b: number): number {
  if (a > 0) {           // +1
    if (b > 0) {         // +1
      for (let i = 0; i < a; i++) {  // +1
        if (i % 2 === 0) {           // +1
          return i;
        }
      }
    }
  }
  return 0;
}
`;

    const result = await analyzeFileUnified(code, 'test.ts');
    const func = result.functions.find((f) => f.name === 'complexFunction');

    expect(func).toBeDefined();
    // Base complexity (1) + 4 control flow nodes = 5
    expect(func?.complexity).toBe(5);
  });

  it('should count logical operators as complexity', async () => {
    const code = `
export function withLogicalOps(a: boolean, b: boolean): boolean {
  return a && b || !a;  // +1 for &&, +1 for ||
}
`;

    const result = await analyzeFileUnified(code, 'test.ts');
    const func = result.functions.find((f) => f.name === 'withLogicalOps');

    expect(func).toBeDefined();
    // Base (1) + && (1) + || (1) = 3
    expect(func?.complexity).toBe(3);
  });

  it('should count switch cases as complexity', async () => {
    const code = `
export function withSwitch(n: number): string {
  switch (n) {
    case 1:    // +1
      return 'one';
    case 2:    // +1
      return 'two';
    default:   // +1
      return 'other';
  }
}
`;

    const result = await analyzeFileUnified(code, 'test.ts');
    const func = result.functions.find((f) => f.name === 'withSwitch');

    expect(func).toBeDefined();
    // Base (1) + 3 switch cases = 4
    expect(func?.complexity).toBe(4);
  });

  it('should detect high complexity issues', async () => {
    // Create a function with complexity > 10
    const code = `
export function highComplexity(a: number): number {
  if (a > 0) {       // +1
    if (a > 1) {     // +1
      if (a > 2) {   // +1
        if (a > 3) { // +1
          if (a > 4) { // +1
            if (a > 5) { // +1
              if (a > 6) { // +1
                if (a > 7) { // +1
                  if (a > 8) { // +1
                    if (a > 9) { // +1
                      return a;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return 0;
}
`;

    const result = await analyzeFileUnified(code, 'test.ts');

    expect(result.complexityIssues.length).toBeGreaterThan(0);
    expect(result.complexityIssues[0]?.message).toContain('high cyclomatic complexity');
  });

  it('should detect long functions', async () => {
    // Create a function with > 50 lines
    const lines = new Array(55).fill('  const x = 1;').join('\n');
    const code = `
export function longFunction(): void {
${lines}
}
`;

    const result = await analyzeFileUnified(code, 'test.ts');

    expect(result.complexityIssues.length).toBeGreaterThan(0);
    expect(result.complexityIssues[0]?.message).toContain('too long');
  });

  it('should track exported vs non-exported functions', async () => {
    const code = `
export function exported() {
  return 1;
}

function notExported() {
  return 2;
}

export const arrowExported = () => {
  return 3;
};
`;

    const result = await analyzeFileUnified(code, 'test.ts');

    const exportedFunc = result.functions.find((f) => f.name === 'exported');
    expect(exportedFunc?.isExported).toBe(true);

    const notExportedFunc = result.functions.find((f) => f.name === 'notExported');
    expect(notExportedFunc?.isExported).toBe(false);
  });

  it('should return both complexityIssues and functions arrays', async () => {
    const code = `
export function test() { return 1; }
`;

    const result = await analyzeFileUnified(code, 'test.ts');

    expect(result).toHaveProperty('complexityIssues');
    expect(result).toHaveProperty('functions');
    expect(Array.isArray(result.complexityIssues)).toBe(true);
    expect(Array.isArray(result.functions)).toBe(true);
  });
});
