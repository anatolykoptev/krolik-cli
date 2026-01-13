/**
 * @module commands/fix/fixers/console/analyzer
 * @description Smart detection of console.* statements with context awareness
 *
 * Classification:
 * - DEBUG: console.log, console.debug, console.trace, console.dir, console.table → remove
 * - PRODUCTION: console.error, console.warn in error handlers → keep
 * - CONTEXT-AWARE: checks if inside catch block, error callback, etc.
 */

import { isInsideLineComment, isInsideStringLine } from '../../../../lib/@ast/swc';
import type { QualityIssue } from '../../core/types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Console methods classified by purpose
 */
const DEBUG_METHODS = ['log', 'debug', 'trace', 'dir', 'table', 'info', 'count', 'time', 'timeEnd'];
const ERROR_METHODS = ['error', 'warn'];

/**
 * Patterns that indicate error handling context
 */
const ERROR_CONTEXT_PATTERNS = [
  /\bcatch\s*\(/i, // catch block
  /\.catch\s*\(/i, // promise catch
  /\bonError\b/i, // error callback
  /\bonReject\b/i, // rejection handler
  /\berror\s*[=:]/i, // error variable assignment
  /\bhandleError\b/i, // error handler function
  /\bif\s*\(\s*error\b/i, // error check
  /\bif\s*\(\s*err\b/i, // err check
  /throw\s+/i, // near throw statement
];

/**
 * Patterns for structured logging (should be kept)
 */
const STRUCTURED_LOGGING_PATTERNS = [
  /\blogger\./i, // logger.info, logger.error
  /\blog\./i, // log.info, log.error
  /(?<!console\.)\bdebug\(/i, // debug() from debug package (not console.debug)
  /\bwinston\b/i, // winston logger
  /\bpino\b/i, // pino logger
  /\bbunyan\b/i, // bunyan logger
];

const CONSOLE_PATTERN = new RegExp(
  `console\\.(${[...DEBUG_METHODS, ...ERROR_METHODS].join('|')})\\s*\\(`,
  'g',
);

// ============================================================================
// CONTEXT DETECTION
// ============================================================================

/**
 * Check if the code context suggests error handling
 */
function isErrorHandlingContext(lines: string[], lineIndex: number): boolean {
  // Check current line and surrounding lines (5 above, 2 below)
  const startIdx = Math.max(0, lineIndex - 5);
  const endIdx = Math.min(lines.length - 1, lineIndex + 2);

  for (let i = startIdx; i <= endIdx; i++) {
    const line = lines[i] ?? '';
    for (const pattern of ERROR_CONTEXT_PATTERNS) {
      if (pattern.test(line)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if line uses structured logging
 */
function isStructuredLogging(line: string): boolean {
  return STRUCTURED_LOGGING_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Determine severity based on method and context
 */
function classifyConsole(
  method: string,
  lines: string[],
  lineIndex: number,
): { severity: 'error' | 'warning' | 'info'; shouldFix: boolean; reason: string } {
  const isDebugMethod = DEBUG_METHODS.includes(method);
  const isErrorMethod = ERROR_METHODS.includes(method);
  const inErrorContext = isErrorHandlingContext(lines, lineIndex);

  // Error/warn in error handling context → likely intentional, low priority
  if (isErrorMethod && inErrorContext) {
    return {
      severity: 'info',
      shouldFix: false,
      reason: 'Error logging in error handler - likely intentional',
    };
  }

  // Debug methods → always flag for removal
  if (isDebugMethod) {
    return {
      severity: 'warning',
      shouldFix: true,
      reason: 'Debug statement should be removed before production',
    };
  }

  // Error/warn outside error context → flag but lower priority
  if (isErrorMethod) {
    return {
      severity: 'info',
      shouldFix: true,
      reason: 'Consider using structured logging instead',
    };
  }

  return {
    severity: 'warning',
    shouldFix: true,
    reason: 'Remove console statement before production',
  };
}

// ============================================================================
// MAIN ANALYZER
// ============================================================================

/**
 * Analyze content for console statements with smart classification
 */
export function analyzeConsole(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip full-line comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Skip structured logging
    if (isStructuredLogging(line)) continue;

    // Reset regex
    CONSOLE_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = CONSOLE_PATTERN.exec(line)) !== null) {
      // Skip if inside comment or string
      if (isInsideLineComment(line, match.index)) continue;
      if (isInsideStringLine(line, match.index)) continue;

      const method = match[1] ?? 'log';
      const classification = classifyConsole(method, lines, i);

      const issue: QualityIssue = {
        file,
        line: i + 1,
        severity: classification.severity,
        category: 'lint',
        message: `console.${method}: ${classification.reason}`,
        suggestion: classification.shouldFix
          ? 'Remove or replace with structured logging'
          : 'Review if this logging is necessary',
        snippet: trimmed.slice(0, 60),
      };

      if (classification.shouldFix) {
        issue.fixerId = 'console';
      }

      issues.push(issue);
    }
  }

  return issues;
}
