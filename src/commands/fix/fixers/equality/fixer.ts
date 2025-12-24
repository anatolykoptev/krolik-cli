/**
 * @module commands/fix/fixers/equality/fixer
 * @description Fix loose equality by replacing with strict equality
 */

import type { FixOperation, QualityIssue } from '../../core/types';

/**
 * Pattern to find and replace loose equality
 */
const LOOSE_EQUALITY_REPLACE = /([^=!<>])(===|!=)([^=])/g;

/**
 * Fix loose equality issue by replacing with strict equality
 */
export function fixEqualityIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) return null;

  const line = lines[lineIndex];
  if (line === undefined) return null;

  // Determine which operator to replace based on the message
  const isDoubleEquals = issue.message.includes("'==='");
  const oldOperator = isDoubleEquals ? '==' : '!=';
  const newOperator = isDoubleEquals ? '===' : '!==';

  // Replace the first occurrence of the loose operator on this line
  // We need to be careful not to replace already strict operators
  let newLine = line;
  let replaced = false;

  newLine = line.replace(
    LOOSE_EQUALITY_REPLACE,
    (match: string, before: string, op: string, after: string) => {
      if (replaced) return match;
      if (op === oldOperator) {
        replaced = true;
        return `${before}${newOperator}${after}`;
      }
      return match;
    },
  );

  if (!replaced && line !== undefined) {
    // Fallback: simple string replacement
    newLine = line.replace(oldOperator, newOperator);
    replaced = newLine !== line;
  }

  if (!replaced) return null;

  return {
    action: 'replace-line',
    file: issue.file,
    line: issue.line,
    oldCode: line,
    newCode: newLine,
  };
}
