/**
 * @module commands/fix/fixers/eval/fixer
 * @description Fix eval() usage - adds TODO comment since auto-fix is risky
 */

import type { FixOperation, QualityIssue } from '../../core/types';
import { addTodoComment } from '../../core/utils';

/**
 * Pattern to match simple JSON.parse conversion: eval('(' + json + ')')
 * This is a common pattern that can be safely converted
 */
const EVAL_JSON_PATTERN = /eval\s*\(\s*['"`]\(\s*['"`]\s*\+\s*(\w+)\s*\+\s*['"`]\s*\)\s*['"`]\s*\)/;

/**
 * Pattern to match direct eval of JSON: eval(jsonString)
 */
const EVAL_DIRECT_PATTERN = /eval\s*\(\s*(\w+)\s*\)/;

/**
 * Fix an eval issue
 *
 * Strategy:
 * 1. Try to convert common eval patterns to JSON.parse
 * 2. For complex cases, add a TODO comment
 */
export function fixEvalIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) return null;

  const line = lines[lineIndex];
  if (line === undefined) return null;

  // Skip new Function() - too risky to auto-fix
  if (issue.message.includes('new Function')) {
    return addTodoComment(issue, line);
  }

  // Try to convert eval('(' + json + ')') to JSON.parse(json)
  const jsonParenMatch = line.match(EVAL_JSON_PATTERN);
  if (jsonParenMatch) {
    const varName = jsonParenMatch[1];
    const newLine = line.replace(EVAL_JSON_PATTERN, `JSON.parse(${varName})`);
    return {
      action: 'replace-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
      newCode: newLine,
    };
  }

  // Try to convert eval(variable) to JSON.parse(variable)
  // This is risky but often the intended use
  const directMatch = line.match(EVAL_DIRECT_PATTERN);
  if (directMatch) {
    const varName = directMatch[1];
    // Only convert if variable name suggests JSON
    if (varName && /json|data|response|config|settings/i.test(varName)) {
      const newLine = line.replace(EVAL_DIRECT_PATTERN, `JSON.parse(${varName})`);
      return {
        action: 'replace-line',
        file: issue.file,
        line: issue.line,
        oldCode: line,
        newCode: newLine,
      };
    }
  }

  // Default: add TODO comment
  return addTodoComment(issue, line);
}
