/**
 * @module tests/commands/fix/helpers
 * @description Test utilities for fix command tests
 */

import type {
  Fixer,
  FixerMetadata,
  QualityIssue,
  QualityCategory,
  QualitySeverity,
  FixDifficulty,
  FixOperation,
  FixAction,
} from '../../../src/commands/fix/core/types';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

/**
 * Create a mock fixer for testing
 */
export function createTestFixer(
  id: string,
  options: Partial<{
    name: string;
    category: QualityCategory;
    difficulty: FixDifficulty;
    cliFlag: string;
    negateFlag: string;
    tags: string[];
    analyze: Fixer['analyze'];
    fix: Fixer['fix'];
    shouldSkip: Fixer['shouldSkip'];
  }> = {}
): Fixer {
  const metadata: FixerMetadata = {
    id,
    name: options.name ?? `Test Fixer ${id}`,
    description: `Test fixer for ${id}`,
    category: options.category ?? 'lint',
    difficulty: options.difficulty ?? 'safe',
    cliFlag: options.cliFlag ?? `--fix-${id}`,
    negateFlag: options.negateFlag,
    tags: options.tags,
  };

  return {
    metadata,
    analyze: options.analyze ?? (() => []),
    fix: options.fix ?? (() => null),
    shouldSkip: options.shouldSkip,
  };
}

/**
 * Create a mock quality issue for testing
 */
export function createTestIssue(
  options: Partial<QualityIssue> & { file: string }
): QualityIssue {
  return {
    file: options.file,
    line: options.line ?? 1,
    severity: options.severity ?? 'warning',
    category: options.category ?? 'lint',
    message: options.message ?? 'Test issue',
    suggestion: options.suggestion,
    snippet: options.snippet,
    fixerId: options.fixerId,
  };
}

/**
 * Create a mock fix operation for testing
 */
export function createTestOperation(
  action: FixAction,
  file: string,
  options: Partial<Omit<FixOperation, 'action' | 'file'>> = {}
): FixOperation {
  return {
    action,
    file,
    line: options.line,
    endLine: options.endLine,
    oldCode: options.oldCode,
    newCode: options.newCode,
    functionName: options.functionName,
    newFiles: options.newFiles,
    moveTo: options.moveTo,
  };
}

/**
 * Test with a temporary file
 * Automatically cleans up after test
 */
export function withTempFile<T>(
  content: string,
  fn: (filepath: string) => T | Promise<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `krolik-test-${Date.now()}-${Math.random().toString(36).slice(2)}.ts`);

    fs.writeFileSync(tmpFile, content, 'utf-8');

    const cleanup = () => {
      try {
        if (fs.existsSync(tmpFile)) {
          fs.unlinkSync(tmpFile);
        }
      } catch (err) {
      }
    };

    try {
      const result = fn(tmpFile);

      if (result instanceof Promise) {
        result
          .then(value => {
            cleanup();
            resolve(value);
          })
          .catch(err => {
            cleanup();
            reject(err);
          });
      } else {
        cleanup();
        resolve(result);
      }
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

/**
 * Test with multiple temporary files
 */
export async function withTempFiles<T>(
  files: Record<string, string>,
  fn: (filepaths: Record<string, string>) => T | Promise<T>
): Promise<T> {
  const tmpDir = os.tmpdir();
  const testDir = path.join(tmpDir, `krolik-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(testDir, { recursive: true });

  const filepaths: Record<string, string> = {};

  // Create all files
  for (const [name, content] of Object.entries(files)) {
    const filepath = path.join(testDir, name);
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filepath, content, 'utf-8');
    filepaths[name] = filepath;
  }

  const cleanup = () => {
    try {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    } catch (err) {
    }
  };

  try {
    const result = await fn(filepaths);
    cleanup();
    return result;
  } catch (err) {
    cleanup();
    throw err;
  }
}

/**
 * Create test file content with specific pattern
 */
export function createTestContent(
  lines: Array<string | { line: string; marker?: string }>
): string {
  return lines
    .map(item => (typeof item === 'string' ? item : item.line))
    .join('\n');
}

/**
 * Assert that a fix operation matches expected values
 */
export function assertFixOperation(
  operation: FixOperation | null,
  expected: Partial<FixOperation> & { action: FixAction }
): asserts operation is FixOperation {
  if (!operation) {
    throw new Error('Expected fix operation but got null');
  }

  if (operation.action !== expected.action) {
    throw new Error(`Expected action ${expected.action} but got ${operation.action}`);
  }

  if (expected.line !== undefined && operation.line !== expected.line) {
    throw new Error(`Expected line ${expected.line} but got ${operation.line}`);
  }

  if (expected.oldCode !== undefined && operation.oldCode !== expected.oldCode) {
    throw new Error(`Expected oldCode "${expected.oldCode}" but got "${operation.oldCode}"`);
  }

  if (expected.newCode !== undefined && operation.newCode !== expected.newCode) {
    throw new Error(`Expected newCode "${expected.newCode}" but got "${operation.newCode}"`);
  }
}

/**
 * Mock console methods for testing
 */
export function mockConsole() {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  const logs: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  console.log = (...args: unknown[]) => logs.push(args.join(' '));
  console.warn = (...args: unknown[]) => warnings.push(args.join(' '));
  console.error = (...args: unknown[]) => errors.push(args.join(' '));

  return {
    logs,
    warnings,
    errors,
    restore() {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    },
  };
}

/**
 * Severity levels for quick testing
 */
export const SEVERITY: Record<'ERROR' | 'WARNING' | 'INFO', QualitySeverity> = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

/**
 * Categories for quick testing
 */
export const CATEGORY: Record<string, QualityCategory> = {
  LINT: 'lint',
  TYPE_SAFETY: 'type-safety',
  COMPLEXITY: 'complexity',
  HARDCODED: 'hardcoded',
  SRP: 'srp',
  SIZE: 'size',
  DOCUMENTATION: 'documentation',
  MIXED_CONCERNS: 'mixed-concerns',
  CIRCULAR_DEP: 'circular-dep',
  COMPOSITE: 'composite',
  AGENT: 'agent',
  REFINE: 'refine',
};

/**
 * Difficulty levels for quick testing
 */
export const DIFFICULTY: Record<'TRIVIAL' | 'SAFE' | 'RISKY', FixDifficulty> = {
  TRIVIAL: 'trivial',
  SAFE: 'safe',
  RISKY: 'risky',
};
