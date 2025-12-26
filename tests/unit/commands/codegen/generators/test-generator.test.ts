/**
 * @module tests/test-generator
 * @description Tests for the test file generator with source analysis
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testGenerator } from '@/commands/codegen/generators/test';

// Mock fs.existsSync and fs.readFileSync
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe('testGenerator', () => {
  const projectRoot = '/test/project';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should generate function-specific tests for exported functions', () => {
    const sourceCode = `
export function parseChecklist(body: string): Item[] {
  return [];
}

export function validateInput(input: string, strict: boolean): boolean {
  return true;
}
`;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);

    const result = testGenerator.generate({
      name: 'parser',
      file: 'src/parser.ts',
      projectRoot,
      noDocs: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/parser.test.ts');

    const content = result[0].content;

    // Should have import for both functions
    expect(content).toContain("import { parseChecklist, validateInput } from './parser';");

    // Should have describe blocks for each function
    expect(content).toContain("describe('parseChecklist'");
    expect(content).toContain("describe('validateInput'");

    // Should have tests with parameter variables
    expect(content).toContain('const body =');
    expect(content).toContain('const input =');
    expect(content).toContain('const strict =');

    // Should call the functions
    expect(content).toContain('parseChecklist(body)');
    expect(content).toContain('validateInput(input, strict)');
  });

  it('should generate async tests for async functions', () => {
    const sourceCode = `
export async function fetchData(url: string): Promise<Data> {
  return await fetch(url);
}
`;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);

    const result = testGenerator.generate({
      name: 'fetcher',
      file: 'src/fetcher.ts',
      projectRoot,
      noDocs: true,
    });

    expect(result).toHaveLength(1);
    const content = result[0].content;

    // Should have async test
    expect(content).toContain('async ()');
    expect(content).toContain('await fetchData');
  });

  it('should generate class tests with method tests', () => {
    const sourceCode = `
export class Parser {
  parse(input: string): Result {
    return { data: input };
  }

  static create(): Parser {
    return new Parser();
  }
}
`;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);

    const result = testGenerator.generate({
      name: 'parser-class',
      file: 'src/parser-class.ts',
      projectRoot,
      noDocs: true,
    });

    expect(result).toHaveLength(1);
    const content = result[0].content;

    // Should have class describe block
    expect(content).toContain("describe('Parser'");

    // Should have instance creation test
    expect(content).toContain('should create instance correctly');
    expect(content).toContain('new Parser()');
    expect(content).toContain('toBeInstanceOf(Parser)');

    // Should have method tests
    expect(content).toContain('instance.parse');
    expect(content).toContain('Parser.create'); // static method uses class name
  });

  it('should fall back to template when analysis fails', () => {
    const invalidCode = `export function broken( {`;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(invalidCode);

    const result = testGenerator.generate({
      name: 'broken',
      file: 'src/broken.ts',
      projectRoot,
      noDocs: true,
    });

    expect(result).toHaveLength(1);

    // Should fall back to generic template
    const content = result[0].content;
    expect(content).toContain("describe('Broken'");
    expect(content).toContain('works correctly');
  });

  it('should use React template for .tsx files', () => {
    const sourceCode = `
import React from 'react';
export function Button() {
  return <button>Click</button>;
}
`;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);

    const result = testGenerator.generate({
      name: 'Button',
      file: 'src/Button.tsx',
      projectRoot,
      noDocs: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0].path).toBe('src/Button.test.tsx');

    const content = result[0].content;

    // React template should be used
    expect(content).toContain('@testing-library/react');
    expect(content).toContain('render');
  });

  it('should handle arrow function exports', () => {
    const sourceCode = `
export const calculate = (a: number, b: number): number => a + b;
`;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);

    const result = testGenerator.generate({
      name: 'calc',
      file: 'src/calc.ts',
      projectRoot,
      noDocs: true,
    });

    expect(result).toHaveLength(1);
    const content = result[0].content;

    expect(content).toContain("describe('calculate'");
    expect(content).toContain('calculate(a, b)');
    expect(content).toContain('const a =');
    expect(content).toContain('const b =');
  });

  it('should handle files with no exports gracefully', () => {
    const sourceCode = `
function internalHelper(): void {}
const privateConst = 42;
`;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);

    const result = testGenerator.generate({
      name: 'internal',
      file: 'src/internal.ts',
      projectRoot,
      noDocs: true,
    });

    expect(result).toHaveLength(1);

    // Should fall back to generic template
    const content = result[0].content;
    expect(content).toContain("describe('Internal'");
  });

  it('should generate appropriate mock values based on parameter types', () => {
    const sourceCode = `
export function process(
  name: string,
  count: number,
  isEnabled: boolean,
  items: string[],
  config: object
): void {}
`;

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue(sourceCode);

    const result = testGenerator.generate({
      name: 'processor',
      file: 'src/processor.ts',
      projectRoot,
      noDocs: true,
    });

    expect(result).toHaveLength(1);
    const content = result[0].content;

    // Should have appropriate mock values based on param names or types
    expect(content).toContain("const name = ''");
    expect(content).toContain('const count = 0');
    // Boolean is inferred from name prefix 'is'
    expect(content).toContain('const isEnabled = false');
    expect(content).toContain('const items = []');
    expect(content).toContain('const config = {}');
  });
});
