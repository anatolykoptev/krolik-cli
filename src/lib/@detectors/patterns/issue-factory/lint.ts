/**
 * @module lib/@detectors/issue-factory/lint
 * @description Factory functions for creating lint quality issues
 */

import { getSnippet, offsetToLine } from '@/lib/@ast/swc';
import type { LintDetection } from '../ast/types';
import { getLintFixerId } from '../fixer-ids';
import type { IssueFactoryContext, QualityIssue } from './types';

// ============================================================================
// LINT ISSUE MESSAGES
// ============================================================================

/** Message templates for lint issues */
const LINT_MESSAGES: Record<
  string,
  { message: (method?: string) => string; severity: 'error' | 'warning'; suggestion: string }
> = {
  console: {
    message: (method) => `Unexpected console statement: console.${method ?? 'log'}`,
    severity: 'warning',
    suggestion: 'Remove console statement or use a proper logging library',
  },
  debugger: {
    message: () => 'Unexpected debugger statement',
    severity: 'error',
    suggestion: 'Remove debugger statement before committing',
  },
  alert: {
    message: (method) => `Unexpected native dialog: ${method ?? 'alert'}()`,
    severity: 'warning',
    suggestion: 'Use a modal component instead of native browser dialogs',
  },
  eval: {
    message: () => 'eval() is a security risk',
    severity: 'error',
    suggestion: 'Avoid eval() - use safer alternatives like JSON.parse() or Function constructor',
  },
  'empty-catch': {
    message: () => 'Empty catch block',
    severity: 'warning',
    suggestion: 'Add error handling logic or at minimum log the error',
  },
};

// ============================================================================
// LINT ISSUE FACTORY
// ============================================================================

/**
 * Create a QualityIssue from a lint detection
 *
 * @param detection - The lint detection from AST analysis
 * @param ctx - Factory context with file info and content
 * @returns QualityIssue or null if detection type is unknown
 *
 * @example
 * ```typescript
 * const issue = createLintIssue(
 *   { type: 'console', offset: 100, method: 'log' },
 *   { filepath: 'src/foo.ts', content, lineOffsets, baseOffset: 0 }
 * );
 * ```
 */
export function createLintIssue(
  detection: LintDetection,
  ctx: IssueFactoryContext,
): QualityIssue | null {
  const config = LINT_MESSAGES[detection.type];
  if (!config) {
    return null;
  }

  const adjustedOffset = detection.offset - ctx.baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, ctx.lineOffsets);
  const snippet = getSnippet(ctx.content, adjustedOffset, ctx.lineOffsets);
  const fixerId = getLintFixerId(detection.type);

  const issue: QualityIssue = {
    file: ctx.filepath,
    line: lineNumber,
    severity: config.severity,
    category: 'lint',
    message: config.message(detection.method),
    suggestion: config.suggestion,
    snippet,
  };

  if (fixerId) {
    issue.fixerId = fixerId;
  }

  return issue;
}

/**
 * Create multiple lint issues from detections
 *
 * @param detections - Array of lint detections
 * @param ctx - Factory context
 * @param options - Optional filtering options
 * @returns Array of QualityIssue objects
 */
export function createLintIssues(
  detections: LintDetection[],
  ctx: IssueFactoryContext,
  options: { skipConsoleInCli?: boolean } = {},
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const detection of detections) {
    // Skip console in CLI files if requested
    if (options.skipConsoleInCli && detection.type === 'console') {
      continue;
    }

    const issue = createLintIssue(detection, ctx);
    if (issue) {
      issues.push(issue);
    }
  }

  return issues;
}
