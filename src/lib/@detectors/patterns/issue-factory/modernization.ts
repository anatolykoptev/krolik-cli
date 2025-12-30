/**
 * @module lib/@detectors/issue-factory/modernization
 * @description Factory functions for creating modernization quality issues
 */

import { getSnippet, offsetToLine } from '@/lib/@ast/swc';
import type { ModernizationDetection } from '../ast/types';
import { getModernizationFixerId } from '../fixer-ids';
import type { IssueFactoryContext, QualityIssue } from './types';

// ============================================================================
// MODERNIZATION ISSUE MESSAGES
// ============================================================================

/** Message templates for modernization issues */
const MODERNIZATION_MESSAGES: Record<
  string,
  { message: (method?: string) => string; severity: 'warning'; suggestion: string }
> = {
  require: {
    message: (method) => `Legacy ${method ?? 'require'}() call`,
    severity: 'warning',
    suggestion: 'Use ES6 import instead: import x from "module"',
  },
};

// ============================================================================
// MODERNIZATION ISSUE FACTORY
// ============================================================================

/**
 * Create a QualityIssue from a modernization detection
 *
 * @param detection - The modernization detection from AST analysis
 * @param ctx - Factory context with file info and content
 * @returns QualityIssue or null if detection type is unknown
 */
export function createModernizationIssue(
  detection: ModernizationDetection,
  ctx: IssueFactoryContext,
): QualityIssue | null {
  const config = MODERNIZATION_MESSAGES[detection.type];
  if (!config) {
    return null;
  }

  const adjustedOffset = detection.offset - ctx.baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, ctx.lineOffsets);
  const snippet = getSnippet(ctx.content, adjustedOffset, ctx.lineOffsets);
  const fixerId = getModernizationFixerId(detection.type);

  const issue: QualityIssue = {
    file: ctx.filepath,
    line: lineNumber,
    severity: config.severity,
    category: 'modernization',
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
 * Create multiple modernization issues from detections
 */
export function createModernizationIssues(
  detections: ModernizationDetection[],
  ctx: IssueFactoryContext,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const detection of detections) {
    const issue = createModernizationIssue(detection, ctx);
    if (issue) {
      issues.push(issue);
    }
  }

  return issues;
}
