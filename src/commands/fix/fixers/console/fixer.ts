/**
 * @module commands/fix/fixers/console/fixer
 * @description Fixes console.* statements by removing them
 */

import type { FixOperation, QualityIssue } from '../../core/types';

/**
 * Get line at specific line number (1-indexed)
 */
function getLine(content: string, lineNum: number): string | null {
  const lines = content.split('\n');
  return lines[lineNum - 1] ?? null;
}

/**
 * Check if line starts with any of the prefixes
 */
function startsWithAny(line: string, prefixes: string[]): boolean {
  const trimmed = line.trim();
  return prefixes.some((p) => trimmed.startsWith(p));
}

/**
 * Check if line ends with any of the suffixes
 */
function endsWithAny(line: string, suffixes: string[]): boolean {
  const trimmed = line.trim();
  return suffixes.some((s) => trimmed.endsWith(s));
}

/**
 * Fix console issue
 */
export function fixConsoleIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const line = getLine(content, issue.line);
  if (!line) return null;

  const trimmed = line.trim();

  // If line is standalone console statement, delete it
  if (startsWithAny(line, ['console.'])) {
    if (endsWithAny(line, [';', ')'])) {
      return {
        action: 'delete-line',
        file: issue.file,
        line: issue.line,
        oldCode: line,
      };
    }
  }

  // If console is part of larger expression, comment it out
  const consolePattern = /console\.\w+\([^)]*\);?/g;
  if (consolePattern.test(line)) {
    const newLine = line.replace(consolePattern, '/* console removed */');
    return {
      action: 'replace-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
      newCode: newLine,
    };
  }

  // Multi-line console - just delete the starting line for now
  if (trimmed.startsWith('console.') && !trimmed.includes(')')) {
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  return null;
}
