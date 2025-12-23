/**
 * @module commands/fix/strategies/lint/fixes
 * @description Fix generators for lint issues
 *
 * Uses AST-based detection to avoid false positives:
 * - Skips 'debugger' inside strings/regex patterns
 * - Skips 'console' inside strings
 * - Only fixes actual statement nodes
 */

import type { QualityIssue } from '../../types';
import type { FixOperation } from '../../types';
import type { FixContext } from '../../context';
import { shouldSkipConsoleFix } from '../../context';
import {
  getLineContext,
  lineStartsWith,
  lineEndsWith,
  createDeleteLine,
  createReplaceLine,
  hasDebuggerStatementAtLine,
  hasConsoleCallAtLine,
  hasAlertCallAtLine,
} from '../shared';
import { DEBUGGER_LINE_PATTERNS } from './constants';

// ============================================================================
// CONSOLE FIX
// ============================================================================

/**
 * Fix console.log statements (with smart detection)
 *
 * Smart behavior:
 * - Uses AST to find real console calls
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

  // AST check: is there a real console call at this line?
  if (!hasConsoleCallAtLine(content, issue.line)) {
    return null;
  }

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
 * Fix debugger statements (always safe to remove)
 *
 * Uses AST to detect real DebuggerStatement nodes,
 * avoiding false positives from 'debugger' in strings/regex.
 */
export function fixDebugger(
  issue: QualityIssue,
  content: string,
): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  // AST check: is there a real debugger statement at this line?
  if (!hasDebuggerStatementAtLine(content, issue.line)) {
    return null;
  }

  const lineCtx = getLineContext(content, issue.line);
  if (!lineCtx) return null;

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
 *
 * Uses AST to detect real alert() calls.
 */
export function fixAlert(
  issue: QualityIssue,
  content: string,
): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  // AST check: is there a real alert call at this line?
  if (!hasAlertCallAtLine(content, issue.line)) {
    return null;
  }

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
