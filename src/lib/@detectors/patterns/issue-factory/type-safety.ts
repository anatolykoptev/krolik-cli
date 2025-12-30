/**
 * @module lib/@detectors/issue-factory/type-safety
 * @description Factory functions for creating type-safety quality issues
 */

import { getSnippet, offsetToLine } from '@/lib/@ast/swc';
import type { ReturnTypeDetection, TypeSafetyDetection } from '../ast/types';
import { getTypeSafetyFixerId, RETURN_TYPE_FIXER_ID, TS_DIRECTIVE_FIXER_ID } from '../fixer-ids';
import type { IssueFactoryContext, QualityIssue } from './types';

// ============================================================================
// TYPE-SAFETY ISSUE MESSAGES
// ============================================================================

/** Message templates for type-safety issues */
const TYPE_SAFETY_MESSAGES: Record<
  string,
  { message: string; severity: 'error' | 'warning' | 'info'; suggestion: string }
> = {
  'any-annotation': {
    message: 'Using `any` type',
    severity: 'warning',
    suggestion: 'Use proper TypeScript types, `unknown`, or generics',
  },
  'any-assertion': {
    message: 'Type assertion to `any`',
    severity: 'warning',
    suggestion: 'Use proper type assertion or fix the underlying type issue',
  },
  'non-null': {
    message: 'Non-null assertion operator (!)',
    severity: 'info',
    suggestion: 'Use optional chaining (?.) or proper null checks',
  },
  'any-param': {
    message: 'Using `any` in parameter type',
    severity: 'warning',
    suggestion: 'Use proper TypeScript parameter type or `unknown`',
  },
  'any-array': {
    message: 'Using `any[]` array type',
    severity: 'warning',
    suggestion: 'Use proper array element type',
  },
  'double-assertion': {
    message: 'Double type assertion (as unknown as)',
    severity: 'info',
    suggestion: 'Consider using proper type guards or fixing the underlying type issue',
  },
};

// ============================================================================
// TYPE-SAFETY ISSUE FACTORY
// ============================================================================

/**
 * Create a QualityIssue from a type-safety detection
 *
 * @param detection - The type-safety detection from AST analysis
 * @param ctx - Factory context with file info and content
 * @returns QualityIssue or null if detection type is unknown
 */
export function createTypeSafetyIssue(
  detection: TypeSafetyDetection,
  ctx: IssueFactoryContext,
): QualityIssue | null {
  const config = TYPE_SAFETY_MESSAGES[detection.type];
  if (!config) {
    return null;
  }

  const adjustedOffset = detection.offset - ctx.baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, ctx.lineOffsets);
  const snippet = getSnippet(ctx.content, adjustedOffset, ctx.lineOffsets);
  const fixerId = getTypeSafetyFixerId(detection.type);

  const issue: QualityIssue = {
    file: ctx.filepath,
    line: lineNumber,
    severity: config.severity,
    category: 'type-safety',
    message: config.message,
    suggestion: config.suggestion,
    snippet,
  };

  if (fixerId) {
    issue.fixerId = fixerId;
  }

  return issue;
}

/**
 * Create multiple type-safety issues from detections
 */
export function createTypeSafetyIssues(
  detections: TypeSafetyDetection[],
  ctx: IssueFactoryContext,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const detection of detections) {
    const issue = createTypeSafetyIssue(detection, ctx);
    if (issue) {
      issues.push(issue);
    }
  }

  return issues;
}

// ============================================================================
// RETURN TYPE ISSUE FACTORY
// ============================================================================

/** Return type message templates */
const RETURN_TYPE_MESSAGES: Record<string, { prefix: string; label: string }> = {
  'missing-return-type-function': {
    prefix: 'Exported function',
    label: 'function',
  },
  'missing-return-type-arrow': {
    prefix: 'Exported arrow function',
    label: 'arrow function',
  },
  'missing-return-type-expression': {
    prefix: 'Exported function expression',
    label: 'function expression',
  },
  'missing-return-type-default': {
    prefix: 'Exported default function',
    label: 'default function',
  },
};

/**
 * Create a QualityIssue from a return type detection
 *
 * @param detection - The return type detection from AST analysis
 * @param ctx - Factory context with file info and content
 * @returns QualityIssue or null if detection type is unknown
 */
export function createReturnTypeIssue(
  detection: ReturnTypeDetection,
  ctx: IssueFactoryContext,
): QualityIssue | null {
  const config = RETURN_TYPE_MESSAGES[detection.type];
  if (!config) {
    return null;
  }

  const adjustedOffset = detection.offset - ctx.baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, ctx.lineOffsets);
  const snippet = getSnippet(ctx.content, adjustedOffset, ctx.lineOffsets);
  const asyncHint = detection.isAsync ? ' (should be Promise<T>)' : '';

  return {
    file: ctx.filepath,
    line: lineNumber,
    severity: 'info',
    category: 'type-safety',
    message: `${config.prefix} "${detection.functionName}" is missing explicit return type${asyncHint}`,
    suggestion: 'Add explicit return type for better type safety',
    snippet,
    fixerId: RETURN_TYPE_FIXER_ID,
  };
}

/**
 * Create multiple return type issues from detections
 */
export function createReturnTypeIssues(
  detections: ReturnTypeDetection[],
  ctx: IssueFactoryContext,
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  for (const detection of detections) {
    const issue = createReturnTypeIssue(detection, ctx);
    if (issue) {
      issues.push(issue);
    }
  }

  return issues;
}

// ============================================================================
// TS DIRECTIVE ISSUE FACTORY
// ============================================================================

/** TS directive types */
export type TsDirectiveType = 'ts-ignore' | 'ts-nocheck' | 'ts-expect-error';

/**
 * Create a QualityIssue for a TS directive (@ts-expect-error, @ts-nocheck, etc.)
 *
 * @param type - Type of TS directive
 * @param line - Line number
 * @param snippet - Code snippet
 * @param filepath - File path
 * @returns QualityIssue
 */
export function createTsDirectiveIssue(
  type: TsDirectiveType,
  line: number,
  snippet: string,
  filepath: string,
): QualityIssue {
  const messages: Record<
    TsDirectiveType,
    { message: string; severity: 'error' | 'info'; suggestion: string }
  > = {
    'ts-ignore': {
      message: '@ts-ignore suppresses TypeScript errors',
      severity: 'error',
      suggestion: 'Fix the type error instead of ignoring it',
    },
    'ts-nocheck': {
      message: '@ts-nocheck disables TypeScript checking for entire file',
      severity: 'error',
      suggestion: 'Remove @ts-nocheck and fix type errors',
    },
    'ts-expect-error': {
      message: '@ts-expect-error without explanation',
      severity: 'info',
      suggestion: 'Add a comment explaining why this is expected',
    },
  };

  const config = messages[type];

  return {
    file: filepath,
    line,
    severity: config.severity,
    category: 'type-safety',
    message: config.message,
    suggestion: config.suggestion,
    snippet,
    fixerId: TS_DIRECTIVE_FIXER_ID,
  };
}
