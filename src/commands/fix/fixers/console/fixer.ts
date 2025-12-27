/**
 * @module commands/fix/fixers/console/fixer
 * @description Fixes console.* statements by removing them
 */

import type { FixOperation, QualityIssue } from '../../core/types';
import {
  createDeleteLine,
  createReplaceLine,
  getLineContext,
  lineEndsWith,
  lineStartsWith,
} from '../../core/utils';

/**
 * Fix console issue
 */
export function fixConsoleIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const ctx = getLineContext(content, issue.line);
  if (!ctx) return null;

  // If line is standalone console statement, delete it
  if (lineStartsWith(ctx.line, ['console.'])) {
    if (lineEndsWith(ctx.line, [';', ')'])) {
      return createDeleteLine(issue.file, issue.line, ctx.line);
    }
  }

  // If console is part of larger expression, comment it out
  const consolePattern = /console\.\w+\([^)]*\);?/g;
  if (consolePattern.test(ctx.line)) {
    const newLine = ctx.line.replace(consolePattern, '/* console removed */');
    return createReplaceLine(issue.file, issue.line, ctx.line, newLine);
  }

  // Multi-line console - just delete the starting line for now
  if (ctx.trimmed.startsWith('console.') && !ctx.trimmed.includes(')')) {
    return createDeleteLine(issue.file, issue.line, ctx.line);
  }

  return null;
}
