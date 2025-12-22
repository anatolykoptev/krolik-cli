/**
 * @module commands/fix/strategies/lint/fixes
 * @description Fix generators for lint issues
 */

import type { QualityIssue } from '../../../quality/types';
import type { FixOperation } from '../../types';
import type { FixContext } from '../../context';
import { shouldSkipConsoleFix } from '../../context';
import {
  getLineContext,
  lineStartsWith,
  lineEndsWith,
  createDeleteLine,
  createReplaceLine,
} from '../shared';
import { DEBUGGER_LINE_PATTERNS } from './constants';

// ============================================================================
// CONSOLE FIX
// ============================================================================

/**
 * Fix console.log statements (with smart detection)
 *
 * Smart behavior:
 * - Skips console in CLI output files
 * - Skips console in test files
 * - Only removes actual debugging statements
 */
export function fixConsole(
  issue: QualityIssue,
  content: string,
  context: FixContext,
): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  // Smart check: should we skip this console?
  if (shouldSkipConsoleFix(context, content, issue.line)) {
    return null;
  }

  const lineCtx = getLineContext(content, issue.line);
  if (!lineCtx) return null;

  // Check if it's a standalone console statement
  if (lineStartsWith(lineCtx.line, ['console.'])) {
    // Check if it ends with semicolon or closing paren
    if (lineEndsWith(lineCtx.line, [';', ')'])) {
      return createDeleteLine(issue.file, issue.line, lineCtx.line);
    }
  }

  // If console is part of larger expression, comment it out
  return createReplaceLine(
    issue.file,
    issue.line,
    lineCtx.line,
    lineCtx.line.replace(/console\.\w+\([^)]*\);?/, '/* console removed */'),
  );
}

// ============================================================================
// DEBUGGER FIX
// ============================================================================

/**
 * Check if 'debugger' word is inside a string or regex literal
 */
function isDebuggerInStringOrRegex(line: string): boolean {
  // Check if line contains regex pattern with debugger
  if (/\/.*debugger.*\//.test(line)) {
    return true;
  }

  // Check if debugger is inside quotes
  if (/['"`].*debugger.*['"`]/.test(line)) {
    return true;
  }

  return false;
}

/**
 * Fix debugger statements (always safe to remove)
 */
export function fixDebugger(
  issue: QualityIssue,
  content: string,
): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lineCtx = getLineContext(content, issue.line);
  if (!lineCtx) return null;

  // Skip if debugger is inside a string or regex (like a pattern definition)
  if (isDebuggerInStringOrRegex(lineCtx.line)) {
    return null;
  }

  // If line is just "debugger;" or "debugger", delete it
  if (DEBUGGER_LINE_PATTERNS.STANDALONE.test(lineCtx.trimmed)) {
    return createDeleteLine(issue.file, issue.line, lineCtx.line);
  }

  // If debugger is part of larger line, remove just the debugger
  return createReplaceLine(
    issue.file,
    issue.line,
    lineCtx.line,
    lineCtx.line.replace(DEBUGGER_LINE_PATTERNS.INLINE, ''),
  );
}

// ============================================================================
// ALERT FIX
// ============================================================================

/**
 * Fix alert statements
 */
export function fixAlert(
  issue: QualityIssue,
  content: string,
): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lineCtx = getLineContext(content, issue.line);
  if (!lineCtx) return null;

  // If line is just alert(), delete it
  if (
    lineStartsWith(lineCtx.line, ['alert(']) &&
    lineEndsWith(lineCtx.line, [');', ')'])
  ) {
    return createDeleteLine(issue.file, issue.line, lineCtx.line);
  }

  // Alert in expression - not safe to auto-fix
  return null;
}
