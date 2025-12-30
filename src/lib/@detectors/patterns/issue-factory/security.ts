/**
 * @module lib/@detectors/issue-factory/security
 * @description Factory functions for creating security quality issues
 */

import { getSnippet, offsetToLine } from '@/lib/@ast/swc';
import type { SecurityDetection } from '../ast/types';
import { getSecurityFixerId } from '../fixer-ids';
import type { IssueFactoryContext, QualityIssue } from './types';

// ============================================================================
// SECURITY ISSUE MESSAGES
// ============================================================================

/** Message templates for security issues */
const SECURITY_MESSAGES: Record<
  string,
  { message: (method?: string) => string; severity: 'error' | 'warning'; suggestion: string }
> = {
  'command-injection': {
    message: (method) => `Command injection risk: ${method ?? 'execSync'}() with template literal`,
    severity: 'error',
    suggestion: 'Validate and sanitize user input, or use execFile with array arguments',
  },
  'path-traversal': {
    message: (method) => `Path traversal risk: ${method ?? 'path.join'}() with unvalidated input`,
    severity: 'warning',
    suggestion:
      'Validate path components before joining, or use path.normalize() and check boundaries',
  },
};

// ============================================================================
// SECURITY ISSUE FACTORY
// ============================================================================

/**
 * Create a QualityIssue from a security detection
 *
 * @param detection - The security detection from AST analysis
 * @param ctx - Factory context with file info and content
 * @returns QualityIssue or null if detection type is unknown
 */
export function createSecurityIssue(
  detection: SecurityDetection,
  ctx: IssueFactoryContext,
): QualityIssue | null {
  const config = SECURITY_MESSAGES[detection.type];
  if (!config) {
    return null;
  }

  const adjustedOffset = detection.offset - ctx.baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, ctx.lineOffsets);
  const snippet = getSnippet(ctx.content, adjustedOffset, ctx.lineOffsets);
  const fixerId = getSecurityFixerId(detection.type);

  const issue: QualityIssue = {
    file: ctx.filepath,
    line: lineNumber,
    severity: config.severity,
    category: 'security',
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
 * Create multiple security issues from detections
 */
export function createSecurityIssues(
  detections: SecurityDetection[],
  ctx: IssueFactoryContext,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const detection of detections) {
    const issue = createSecurityIssue(detection, ctx);
    if (issue) {
      issues.push(issue);
    }
  }

  return issues;
}
