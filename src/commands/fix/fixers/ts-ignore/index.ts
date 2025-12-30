/**
 * @module commands/fix/fixers/ts-ignore
 * @description TypeScript ignore comment fixer
 *
 * Detects and removes @ts-expect-error and @ts-nocheck comments.
 */

import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';

export const metadata = createFixerMetadata('ts-ignore', 'TS-Ignore Comments', 'type-safety', {
  description: 'Remove @ts-ignore/@ts-nocheck comments',
  difficulty: 'risky', // TODO: not production-ready
  cliFlag: '--fix-ts-ignore',
  tags: ['safe', 'type-safety'],
});

const TS_IGNORE_PATTERNS = {
  tsIgnore: /@ts-ignore/g,
  tsNocheck: /@ts-nocheck/g,
  tsExpectError: /@ts-expect-error/g,
  standaloneLine: /^\s*\/\/\s*@ts-(ignore|nocheck|expect-error)/,
  standaloneBlock: /^\s*\/\*\s*@ts-(ignore|nocheck|expect-error)\s*\*\/\s*$/,
};

/**
 * Check if a line contains an ACTUAL @ts-expect-error/nocheck/expect-error directive.
 * Only matches TypeScript comment directives, not string literals, regex patterns, etc.
 */
function isActualTsDirective(line: string, directive: string): boolean {
  // Pattern: // @ts-directive or /* @ts-directive */
  // Must have the comment markers immediately before the directive
  const singleLineMatch = new RegExp(`//\\s*${directive}`).test(line);
  const blockMatch = new RegExp(`/\\*\\s*${directive}`).test(line);

  if (!singleLineMatch && !blockMatch) return false;

  // Additional check: the // or /* should not be inside a string
  // Find the position of the directive
  const directivePos = line.indexOf(directive);
  if (directivePos === -1) return false;

  // Check what's before the directive
  const before = line.slice(0, directivePos);

  // Count quotes - if odd, we're inside a string
  const singleQuotes = (before.match(/'/g) || []).length;
  const doubleQuotes = (before.match(/"/g) || []).length;
  const backticks = (before.match(/`/g) || []).length;

  if (singleQuotes % 2 === 1 || doubleQuotes % 2 === 1 || backticks % 2 === 1) {
    return false;
  }

  // Check if inside a regex (between /)
  // Simple heuristic: if there's an odd number of unescaped forward slashes
  // This is imperfect but catches most cases
  const slashMatches = before.match(/(?<!\\)\//g) || [];
  if (slashMatches.length % 2 === 1) {
    return false;
  }

  return true;
}

function analyzeTsIgnore(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  // Skip .d.ts files
  if (file.endsWith('.d.ts')) return issues;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Check for @ts-expect-error
    if (isActualTsDirective(line, '@ts-ignore')) {
      issues.push({
        file,
        line: i + 1,
        severity: 'error',
        category: 'type-safety',
        message: '@ts-ignore suppresses TypeScript errors',
        suggestion: 'Fix the type error instead of ignoring it',
        snippet: line.trim().slice(0, 60),
        fixerId: 'ts-ignore',
      });
    }

    // Check for @ts-nocheck
    if (isActualTsDirective(line, '@ts-nocheck')) {
      issues.push({
        file,
        line: i + 1,
        severity: 'error',
        category: 'type-safety',
        message: '@ts-nocheck disables TypeScript checking for entire file',
        suggestion: 'Remove @ts-nocheck and fix type errors',
        snippet: line.trim().slice(0, 60),
        fixerId: 'ts-ignore',
      });
    }
  }

  return issues;
}

function fixTsIgnoreIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');
  const line = lines[issue.line - 1];
  if (!line) return null;

  // If line is just the comment, delete it
  if (
    TS_IGNORE_PATTERNS.standaloneLine.test(line) ||
    TS_IGNORE_PATTERNS.standaloneBlock.test(line)
  ) {
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  // If inline, remove just the comment part
  const newLine = line
    .replace(/\/\/\s*@ts-(ignore|nocheck|expect-error)[^\n]*/g, '')
    .replace(/\/\*\s*@ts-(ignore|nocheck|expect-error)\s*\*\//g, '');

  if (newLine !== line) {
    return {
      action: 'replace-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
      newCode: newLine,
    };
  }

  return null;
}

export const tsIgnoreFixer: Fixer = {
  metadata,
  analyze: analyzeTsIgnore,
  fix: fixTsIgnoreIssue,
};
