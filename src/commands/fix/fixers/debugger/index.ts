/**
 * @module commands/fix/fixers/debugger
 * @description Debugger statement fixer
 *
 * Detects and removes `debugger` statements.
 * Always safe to remove - these are debugging artifacts.
 */

import { isInsideLineComment, isInsideStringLine } from '../../../../lib/@ast/swc';
import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';
import {
  createDeleteLine,
  createReplaceLine,
  getLineContext,
  isComment,
  splitLines,
} from '../../core/utils';

/**
 * Debugger fixer metadata
 */
export const metadata = createFixerMetadata('debugger', 'Debugger Statements', 'lint', {
  description: 'Remove debugger statements',
  difficulty: 'trivial',
  cliFlag: '--fix-debugger',
  negateFlag: '--no-debugger',
  tags: ['trivial', 'safe-to-autofix', 'debugging'],
});

/**
 * Pattern to match debugger statements
 */
const DEBUGGER_PATTERN = /^\s*debugger\s*;?\s*$/;

/**
 * Inline debugger pattern
 */
const INLINE_DEBUGGER = /\bdebugger\s*;?/g;

/**
 * Pattern to match standalone debugger keyword
 * NOT property access (options.debugger) or identifiers (fixDebugger)
 */
const DEBUGGER_KEYWORD = /(?<![.\w])debugger(?!\s*[:\w])/g;

/**
 * Analyze content for debugger statements
 */
function analyzeDebugger(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = splitLines(content);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip full-line comments
    if (isComment(line)) continue;

    // Find standalone debugger keyword using word boundary
    DEBUGGER_KEYWORD.lastIndex = 0;
    const match = DEBUGGER_KEYWORD.exec(line);
    if (!match) continue;

    const idx = match.index;

    // Skip if inside comment or string
    if (isInsideLineComment(line, idx)) continue;
    if (isInsideStringLine(line, idx)) continue;

    issues.push({
      file,
      line: i + 1,
      severity: 'warning',
      category: 'lint',
      message: 'Unexpected debugger statement',
      suggestion: 'Remove debugger statement before production',
      snippet: trimmed.slice(0, 60),
      fixerId: 'debugger',
    });
  }

  return issues;
}

/**
 * Fix debugger issue
 */
function fixDebuggerIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const ctx = getLineContext(content, issue.line);
  if (!ctx) return null;

  // If line is just "debugger;" or "debugger", delete it
  if (DEBUGGER_PATTERN.test(ctx.line)) {
    return createDeleteLine(issue.file, issue.line, ctx.line);
  }

  // If debugger is part of larger line, remove just the debugger
  const newLine = ctx.line.replace(INLINE_DEBUGGER, '');
  return createReplaceLine(issue.file, issue.line, ctx.line, newLine);
}

/**
 * Debugger fixer implementation
 */
export const debuggerFixer: Fixer = {
  metadata,
  analyze: analyzeDebugger,
  fix: fixDebuggerIssue,
};
