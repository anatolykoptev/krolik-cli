/**
 * @module commands/fix/fixers/alert
 * @description Alert statement fixer
 *
 * Detects and removes alert() calls.
 */

import { isInsideLineComment, isInsideStringLine } from '../../../../lib/parsing/swc';
import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';
import { createDeleteLine, getLineContext, isComment, splitLines } from '../../core/utils';

export const metadata = createFixerMetadata('alert', 'Alert Statements', 'lint', {
  description: 'Remove alert() calls',
  difficulty: 'trivial',
  cliFlag: '--fix-alert',
  tags: ['trivial', 'safe-to-autofix', 'debugging'],
});

const ALERT_PATTERN = /\balert\s*\(/g;

function analyzeAlert(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = splitLines(content);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip full-line comments
    if (isComment(line)) continue;

    // Reset regex
    ALERT_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = ALERT_PATTERN.exec(line)) !== null) {
      // Skip if inside comment or string
      if (isInsideLineComment(line, match.index)) continue;
      if (isInsideStringLine(line, match.index)) continue;

      issues.push({
        file,
        line: i + 1,
        severity: 'warning',
        category: 'lint',
        message: 'Unexpected alert statement',
        suggestion: 'Remove alert() before production',
        snippet: trimmed.slice(0, 60),
        fixerId: 'alert',
      });
    }
  }

  return issues;
}

function fixAlertIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const ctx = getLineContext(content, issue.line);
  if (!ctx) return null;

  // If line is just alert(), delete it
  if (
    ctx.trimmed.startsWith('alert(') &&
    (ctx.trimmed.endsWith(');') || ctx.trimmed.endsWith(')'))
  ) {
    return createDeleteLine(issue.file, issue.line, ctx.line);
  }

  return null;
}

export const alertFixer: Fixer = {
  metadata,
  analyze: analyzeAlert,
  fix: fixAlertIssue,
};
