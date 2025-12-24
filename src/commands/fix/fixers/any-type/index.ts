/**
 * @module commands/fix/fixers/any-type
 * @description Any type fixer
 *
 * Detects `any` type usage and replaces with `unknown`.
 */

import { createFixerMetadata } from '../../core/registry';
import { isInsideComment, isInsideString } from '../../core/string-utils';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';

export const metadata = createFixerMetadata('any-type', 'Any Type Usage', 'type-safety', {
  description: 'Replace `any` with `unknown`',
  difficulty: 'safe',
  cliFlag: '--fix-any',
  negateFlag: '--no-any',
  tags: ['safe', 'type-safety'],
});

const ANY_PATTERNS = [
  /:\s*any\s*[;,)>\]=]/g, // : any; or : any, or : any) etc
  /as\s+any\b/g, // as any
  /<any>/g, // <any>
  /:\s*any\[\]/g, // : any[]
];

function analyzeAnyType(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  // Skip .d.ts and test files
  if (file.endsWith('.d.ts') || file.includes('.test.') || file.includes('.spec.')) {
    return issues;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Remove comments before checking
    const codeOnly = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');

    for (const pattern of ANY_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec loop
      while ((match = pattern.exec(codeOnly)) !== null) {
        // Skip if inside string or comment
        if (isInsideComment(line, match.index)) continue;
        if (isInsideString(line, match.index)) continue;

        issues.push({
          file,
          line: i + 1,
          severity: 'warning',
          category: 'type-safety',
          message: 'Using `any` type',
          suggestion: 'Use proper TypeScript types, `unknown`, or generics',
          snippet: trimmed.slice(0, 60),
          fixerId: 'any-type',
        });
        break; // One issue per line per pattern
      }
    }
  }

  return issues;
}

function fixAnyTypeIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');
  const line = lines[issue.line - 1];
  if (!line) return null;

  // Replace any with unknown
  let newLine = line;
  let replaced = false;

  // Replace : any with : unknown
  if (/:\s*any\b/.test(line)) {
    newLine = newLine.replace(/:\s*any\b/g, ': unknown');
    replaced = true;
  }

  // Replace as any with as unknown
  if (/as\s+any\b/.test(line)) {
    newLine = newLine.replace(/as\s+any\b/g, 'as unknown');
    replaced = true;
  }

  // Replace <any> with <unknown>
  if (/<any>/.test(line)) {
    newLine = newLine.replace(/<any>/g, '<unknown>');
    replaced = true;
  }

  if (replaced && newLine !== line) {
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

export const anyTypeFixer: Fixer = {
  metadata,
  analyze: analyzeAnyType,
  fix: fixAnyTypeIssue,
};
