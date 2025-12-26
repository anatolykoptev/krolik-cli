/**
 * @module tests/source-analyzer
 * @description Tests for source-analyzer
 */

import { describe, expect, it } from 'vitest';
import { analyzeSourceFile } from '@/commands/codegen/services/source-analyzer';

describe('analyzeSourceFile', () => {
  it('should extract exported function declarations', () => {
    const code = `
export function parseChecklist(body: string): Item[] {
  return [];
}
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0]).toMatchObject({
      name: 'parseChecklist',
      kind: 'function',
      isAsync: false,
      isDefault: false,
    });
    expect(result.exports[0].params).toHaveLength(1);
    expect(result.exports[0].params[0]).toMatchObject({
      name: 'body',
      type: 'string',
      isOptional: false,
      hasDefault: false,
    });
  });

  it('should extract async functions', () => {
    const code = `
export async function fetchData(url: string): Promise<Data> {
  return fetch(url);
}
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].isAsync).toBe(true);
  });

  it('should extract arrow function exports', () => {
    const code = `
export const calculate = (a: number, b: number): number => {
  return a + b;
};
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0]).toMatchObject({
      name: 'calculate',
      kind: 'function',
      isAsync: false,
    });
    expect(result.exports[0].params).toHaveLength(2);
    expect(result.exports[0].params[0].name).toBe('a');
    expect(result.exports[0].params[1].name).toBe('b');
  });

  it('should extract class exports with methods', () => {
    const code = `
export class Parser {
  parse(input: string): Result {
    return { data: input };
  }

  async asyncMethod(): Promise<void> {
    return;
  }

  static create(): Parser {
    return new Parser();
  }
}
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0]).toMatchObject({
      name: 'Parser',
      kind: 'class',
    });
    expect(result.exports[0].methods).toHaveLength(3);
    expect(result.exports[0].methods?.[0]).toMatchObject({
      name: 'parse',
      isAsync: false,
      isStatic: false,
    });
    expect(result.exports[0].methods?.[1]).toMatchObject({
      name: 'asyncMethod',
      isAsync: true,
      isStatic: false,
    });
    expect(result.exports[0].methods?.[2]).toMatchObject({
      name: 'create',
      isAsync: false,
      isStatic: true,
    });
  });

  it('should handle multiple exports', () => {
    const code = `
export function foo(): void {}
export function bar(x: number): number { return x; }
export const baz = (s: string) => s.length;
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports).toHaveLength(3);
    expect(result.exports.map((e) => e.name)).toEqual(['foo', 'bar', 'baz']);
  });

  it('should handle optional parameters', () => {
    const code = `
export function greet(name?: string): string {
  return name ?? 'World';
}
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports[0].params[0]).toMatchObject({
      name: 'name',
      isOptional: true,
      hasDefault: false,
    });
  });

  it('should handle default parameters', () => {
    const code = `
export function greet(name = 'World'): string {
  return name;
}
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports[0].params[0]).toMatchObject({
      name: 'name',
      isOptional: true,
      hasDefault: true,
    });
  });

  it('should handle rest parameters', () => {
    const code = `
export function sum(...numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0);
}
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports[0].params[0]).toMatchObject({
      name: 'numbers',
      isOptional: true,
      hasDefault: false,
    });
  });

  it('should handle object pattern parameters', () => {
    const code = `
export function configure({ host, port }: Config): void {}
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports[0].params[0]).toMatchObject({
      name: 'options',
      type: 'object',
    });
  });

  it('should return error for invalid syntax', () => {
    const code = `
export function broken( {
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.exports).toHaveLength(0);
  });

  it('should ignore non-exported functions', () => {
    const code = `
function internalHelper(): void {}

export function publicApi(): void {
  internalHelper();
}
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0].name).toBe('publicApi');
  });

  it('should handle default exports', () => {
    const code = `
export default function main(): void {}
`;
    const result = analyzeSourceFile('test.ts', code);

    expect(result.success).toBe(true);
    expect(result.exports).toHaveLength(1);
    expect(result.exports[0]).toMatchObject({
      name: 'main',
      isDefault: true,
    });
  });
});
