/**
 * @module commands/fix/strategies/type-safety
 * @description Fix strategies for TypeScript type safety issues
 */

import type { QualityIssue } from '../../quality/types';
import type { FixOperation, FixStrategy } from '../types';

/**
 * Fix @ts-ignore comments
 */
function fixTsIgnore(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];

  if (!line) return null;

  const trimmed = line.trim();

  // If line is just @ts-ignore comment, delete it
  if (trimmed === '// @ts-ignore' || trimmed === '/* @ts-ignore */') {
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  // If @ts-ignore is inline, remove it
  if (line.includes('@ts-ignore')) {
    return {
      action: 'replace-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
      newCode: line.replace(/\/\/\s*@ts-ignore\s*/g, '').replace(/\/\*\s*@ts-ignore\s*\*\/\s*/g, ''),
    };
  }

  return null;
}

/**
 * Fix @ts-nocheck comments
 */
function fixTsNocheck(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];

  if (!line) return null;

  // Delete the @ts-nocheck line
  if (line.includes('@ts-nocheck')) {
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  return null;
}

/**
 * Fix explicit 'any' type
 */
function fixAnyType(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];

  if (!line) return null;

  // Replace : any with : unknown
  // Be careful to only replace type annotations, not variable names containing 'any'
  const anyPatterns = [
    /:\s*any\b/g,           // : any
    /:\s*any\[\]/g,         // : any[]
    /:\s*any\s*\|/g,        // : any |
    /\|\s*any\b/g,          // | any
    /<any>/g,               // <any>
    /<any,/g,               // <any,
    /,\s*any>/g,            // , any>
  ];

  let newLine = line;
  let replaced = false;

  for (const pattern of anyPatterns) {
    if (pattern.test(line)) {
      newLine = newLine.replace(pattern, (match) => {
        replaced = true;
        return match.replace(/\bany\b/, 'unknown');
      });
    }
  }

  if (replaced) {
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

/**
 * Fix non-null assertions (!)
 */
function fixNonNullAssertion(issue: QualityIssue, content: string): FixOperation | null {
  // Non-null assertions are risky to auto-fix
  // We'd need to add proper null checks which requires understanding context
  // For now, we just flag these but don't auto-fix
  return null;
}

/**
 * Type safety fix strategy
 */
export const typeSafetyStrategy: FixStrategy = {
  categories: ['type-safety'],

  canFix(issue: QualityIssue, content: string): boolean {
    const { message } = issue;
    // Only handle safe type-safety fixes
    return (
      message.includes('@ts-ignore') ||
      message.includes('@ts-nocheck') ||
      message.includes('explicit any')
    );
  },

  generateFix(issue: QualityIssue, content: string): FixOperation | null {
    const { message } = issue;

    if (message.includes('@ts-ignore')) {
      return fixTsIgnore(issue, content);
    }

    if (message.includes('@ts-nocheck')) {
      return fixTsNocheck(issue, content);
    }

    if (message.includes('explicit any') || message.includes(': any')) {
      return fixAnyType(issue, content);
    }

    return null;
  },
};
