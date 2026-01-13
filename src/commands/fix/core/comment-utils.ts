/**
 * @module commands/fix/core/comment-utils
 * @description Comment-related utilities for fixers
 *
 * Shared utilities for adding TODO comments and other
 * comment-based fixes.
 */

import type { FixOperation, QualityIssue } from './types';

/**
 * Add a TODO comment above a problematic line
 *
 * Preserves the indentation of the target line.
 *
 * @param issue - The quality issue to comment
 * @param line - The original line content (for indentation)
 * @param message - The TODO message (default: generic security warning)
 * @returns Fix operation to insert comment
 *
 * @example
 * ```ts
 * const fix = addTodoComment(issue, line);
 * // Inserts: "// TODO: Security risk - refactor to avoid eval()"
 *
 * const customFix = addTodoComment(issue, line, 'Needs null check');
 * // Inserts: "// TODO: Needs null check"
 * ```
 */
export function addTodoComment(
  issue: QualityIssue,
  line: string,
  message = 'Security risk - refactor to avoid eval()',
): FixOperation {
  const indent = line.match(/^(\s*)/)?.[1] ?? '';

  return {
    action: 'insert-before',
    file: issue.file,
    line: issue.line,
    newCode: `${indent}// TODO: ${message}`,
  };
}
