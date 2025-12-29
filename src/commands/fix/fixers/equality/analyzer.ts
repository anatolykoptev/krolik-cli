/**
 * @module commands/fix/fixers/equality/analyzer
 * @description Detect loose equality (== and !=) usage
 */

import { isInsideStringOrComment } from '../../../../lib/@ast/swc';
import type { QualityIssue } from '../../core/types';

/**
 * Patterns for loose equality operators
 * Matches == or != that are NOT followed by = (i.e., not === or !==)
 */
const LOOSE_EQUALITY_PATTERN = /([^=!<>])(\s*)(==|!=)(?!=)(\s*)([^=])/g;

/**
 * Analyze content for loose equality usage
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Regex matching requires nested loops
export function analyzeEquality(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    if (line === undefined) continue;

    const lineNumber = lineIndex + 1;

    // Calculate offset for this line
    const lineOffset = lines.slice(0, lineIndex).join('\n').length + (lineIndex > 0 ? 1 : 0);

    // Find loose equality in line
    LOOSE_EQUALITY_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec loop pattern
    while ((match = LOOSE_EQUALITY_PATTERN.exec(line)) !== null) {
      const operator = match[3];
      const before = match[1];
      const space = match[2];
      if (operator === undefined || before === undefined || space === undefined) continue;

      const matchIndex = lineOffset + match.index + before.length + space.length;

      // Skip if inside string or comment
      if (isInsideStringOrComment(content, matchIndex)) {
        continue;
      }

      const isDoubleEquals = operator === '==';
      const strictOperator = isDoubleEquals ? '===' : '!==';

      issues.push({
        file,
        line: lineNumber,
        severity: 'warning',
        category: 'type-safety',
        message: `Use strict equality '${strictOperator}' instead of '${operator}'`,
        suggestion: `Replace '${operator}' with '${strictOperator}' for type-safe comparison`,
        snippet: line?.trim() ?? '',
        fixerId: 'equality',
      });

      // Reset pattern to avoid infinite loop on overlapping matches
      LOOSE_EQUALITY_PATTERN.lastIndex = match.index + match[0].length - 1;
    }
  }

  return issues;
}
