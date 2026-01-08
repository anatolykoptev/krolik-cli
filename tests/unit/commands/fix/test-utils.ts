/**
 * @module tests/unit/commands/fix/test-utils
 * @description Test utilities for fix command tests
 */

import type { FixOperation, QualityIssue } from '@/commands/fix/core/types';

/**
 * Create a mock quality issue for testing
 */
export function createMockIssue(overrides: Partial<QualityIssue> = {}): QualityIssue {
  return {
    file: 'test.ts',
    line: 1,
    severity: 'warning',
    category: 'lint',
    message: 'Test issue',
    suggestion: 'Fix this issue',
    fixerId: 'test',
    ...overrides,
  };
}

/**
 * Apply a fix operation to content and return result
 */
export function applyFix(content: string, fix: FixOperation): string {
  const lines = content.split('\n');

  switch (fix.action) {
    case 'delete':
      if (fix.startLine && fix.endLine) {
        lines.splice(fix.startLine - 1, fix.endLine - fix.startLine + 1);
      } else if (fix.startLine) {
        lines.splice(fix.startLine - 1, 1);
      }
      break;

    case 'replace':
      if (fix.startLine && fix.newCode !== undefined) {
        lines[fix.startLine - 1] = fix.newCode;
      }
      break;

    case 'insert':
      if (fix.startLine && fix.newCode !== undefined) {
        lines.splice(fix.startLine - 1, 0, fix.newCode);
      }
      break;
  }

  return lines.join('\n');
}

/**
 * Normalize whitespace for comparison
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Create multi-line test content
 */
export function dedent(strings: TemplateStringsArray, ...values: unknown[]): string {
  let result = strings.reduce((acc, str, i) => acc + str + (values[i] ?? ''), '');

  // Remove leading newline
  if (result.startsWith('\n')) {
    result = result.slice(1);
  }

  // Find minimum indentation
  const lines = result.split('\n');
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);
  const minIndent = Math.min(
    ...nonEmptyLines.map((line) => {
      const match = line.match(/^(\s*)/);
      return match ? match[1].length : 0;
    }),
  );

  // Remove that indentation from all lines
  return lines.map((line) => line.slice(minIndent)).join('\n');
}

/**
 * Assert that issues were found at specific lines
 */
export function expectIssuesAtLines(issues: QualityIssue[], expectedLines: number[]): void {
  const actualLines = issues.map((i) => i.line).sort((a, b) => (a ?? 0) - (b ?? 0));
  const sortedExpected = [...expectedLines].sort((a, b) => a - b);

  expect(actualLines).toEqual(sortedExpected);
}

/**
 * Assert that no issues were found
 */
export function expectNoIssues(issues: QualityIssue[]): void {
  expect(issues).toHaveLength(0);
}

/**
 * Assert that a specific number of issues were found
 */
export function expectIssueCount(issues: QualityIssue[], count: number): void {
  expect(issues).toHaveLength(count);
}

/**
 * Create test file path with proper extension
 */
export function testFile(name: string, ext: 'ts' | 'tsx' | 'js' | 'jsx' = 'ts'): string {
  return `src/${name}.${ext}`;
}
