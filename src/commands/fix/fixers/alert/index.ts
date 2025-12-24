/**
 * @module commands/fix/fixers/alert
 * @description Alert statement fixer
 *
 * Detects and removes alert() calls.
 */

import { createFixerMetadata } from '../../core/registry';
import { isInsideComment, isInsideString } from '../../core/string-utils';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';

export const metadata = createFixerMetadata('alert', 'Alert Statements', 'lint', {
  description: 'Remove alert() calls',
  difficulty: 'trivial',
  cliFlag: '--fix-alert',
  tags: ['trivial', 'safe-to-autofix', 'debugging'],
});

const ALERT_PATTERN = /\balert\s*\(/g;

function analyzeAlert(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip full-line comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Reset regex
    ALERT_PATTERN.lastIndex = 0;

    let match;
    while ((match = ALERT_PATTERN.exec(line)) !== null) {
      // Skip if inside comment or string
      if (isInsideComment(line, match.index)) continue;
      if (isInsideString(line, match.index)) continue;

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

  const lines = content.split('\n');
  const line = lines[issue.line - 1];
  if (!line) return null;

  const trimmed = line.trim();

  // If line is just alert(), delete it
  if (trimmed.startsWith('alert(') && (trimmed.endsWith(');') || trimmed.endsWith(')'))) {
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  return null;
}

export const alertFixer: Fixer = {
  metadata,
  analyze: analyzeAlert,
  fix: fixAlertIssue,
};
