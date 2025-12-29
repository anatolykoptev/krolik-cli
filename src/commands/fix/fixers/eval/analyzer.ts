/**
 * @module commands/fix/fixers/eval/analyzer
 * @description Detect eval() usage - a security risk
 */

import { getLineContent, getLineNumber, isInsideStringOrComment } from '../../../../lib/@ast/swc';
import type { QualityIssue } from '../../core/types';

/**
 * Pattern to match eval() calls
 */
const EVAL_PATTERN = /\beval\s*\(/g;

/**
 * Pattern to match Function() constructor (similar security risk)
 */
const FUNCTION_CONSTRUCTOR_PATTERN = /\bnew\s+Function\s*\(/g;

/**
 * Analyze content for eval() usage
 */
export function analyzeEval(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Find eval() calls
  EVAL_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec loop pattern
  while ((match = EVAL_PATTERN.exec(content)) !== null) {
    // Skip if inside string or comment
    if (isInsideStringOrComment(content, match.index)) {
      continue;
    }

    const lineNumber = getLineNumber(content, match.index);
    const lineContent = getLineContent(content, lineNumber);

    issues.push({
      file,
      line: lineNumber,
      severity: 'error',
      category: 'type-safety',
      message: 'Security risk: eval() executes arbitrary code',
      suggestion: 'Replace with JSON.parse() for JSON, or refactor to avoid dynamic code execution',
      snippet: lineContent.trim(),
      fixerId: 'eval',
    });
  }

  // Find new Function() calls
  FUNCTION_CONSTRUCTOR_PATTERN.lastIndex = 0;

  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec loop pattern
  while ((match = FUNCTION_CONSTRUCTOR_PATTERN.exec(content)) !== null) {
    if (isInsideStringOrComment(content, match.index)) {
      continue;
    }

    const lineNumber = getLineNumber(content, match.index);
    const lineContent = getLineContent(content, lineNumber);

    issues.push({
      file,
      line: lineNumber,
      severity: 'warning',
      category: 'type-safety',
      message: 'Security risk: new Function() can execute arbitrary code',
      suggestion: 'Refactor to use regular functions or arrow functions',
      snippet: lineContent.trim(),
      fixerId: 'eval',
    });
  }

  return issues;
}
