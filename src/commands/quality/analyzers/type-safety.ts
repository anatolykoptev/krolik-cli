/**
 * @module commands/quality/analyzers/type-safety
 * @description TypeScript type safety issue detection
 */

import type { QualityIssue, QualitySeverity } from '../types';

/**
 * Type safety pattern definitions
 */
interface TypeSafetyPattern {
  pattern: RegExp;
  message: string;
  suggestion: string;
  severity: QualitySeverity;
}

/**
 * Patterns indicating weak type safety
 */
const TYPE_SAFETY_PATTERNS: TypeSafetyPattern[] = [
  {
    pattern: /:\s*any\s*[;,)>\]=]/g,
    message: 'Using `any` type',
    suggestion: 'Use proper TypeScript types, `unknown`, or generics',
    severity: 'warning',
  },
  {
    pattern: /as\s+any\b/g,
    message: 'Type assertion to `any`',
    suggestion: 'Use proper type assertion or fix the underlying type issue',
    severity: 'warning',
  },
  {
    pattern: /@ts-ignore/g,
    message: '@ts-ignore suppresses TypeScript errors',
    suggestion: 'Fix the type error instead of ignoring it',
    severity: 'error',
  },
  {
    pattern: /@ts-nocheck/g,
    message: '@ts-nocheck disables TypeScript checking for entire file',
    suggestion: 'Remove @ts-nocheck and fix type errors',
    severity: 'error',
  },
  {
    pattern: /@ts-expect-error(?!\s+—)/g,
    message: '@ts-expect-error without explanation',
    suggestion: 'Add a comment explaining why this is expected',
    severity: 'info',
  },
  {
    pattern: /!\s*\./g, // non-null assertion
    message: 'Non-null assertion operator (!)',
    suggestion: 'Use optional chaining (?.) or proper null checks',
    severity: 'info',
  },
];

/**
 * Check if a line contains a pattern inside a string/regex literal
 * Prevents false positives when detecting patterns in code that searches for those patterns
 */
function isInsideLiteral(line: string, patternStr: string): boolean {
  // Escape special regex characters for safe matching
  const escaped = patternStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Check if pattern appears inside a regex literal /pattern/
  const regexLiteralPattern = new RegExp(`/[^/]*${escaped}[^/]*/`);
  if (regexLiteralPattern.test(line)) return true;

  // Check if pattern appears inside a string literal
  const inSingleQuotes = new RegExp(`'[^']*${escaped}[^']*'`);
  const inDoubleQuotes = new RegExp(`"[^"]*${escaped}[^"]*"`);
  const inBackticks = new RegExp(`\`[^\`]*${escaped}[^\`]*\``);

  return inSingleQuotes.test(line) || inDoubleQuotes.test(line) || inBackticks.test(line);
}

/**
 * Remove inline comments from a line of code
 */
function stripInlineComments(line: string): string {
  return line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
}

/**
 * Check for type safety issues
 */
export function checkTypeSafety(content: string, filepath: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  // Skip .d.ts files and test files
  if (filepath.endsWith('.d.ts') || filepath.includes('.test.') || filepath.includes('.spec.')) {
    return issues;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip full-line comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Remove inline comments before checking patterns
    const codeOnly = stripInlineComments(line);

    for (const { pattern, message, suggestion, severity } of TYPE_SAFETY_PATTERNS) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;
      if (pattern.test(codeOnly)) {
        // Extract pattern string for literal check
        const patternStr = pattern.source.replace(/\\b|\\s|\*/g, '').slice(0, 15);

        // Skip if the pattern is inside a string or regex literal (false positive)
        if (isInsideLiteral(codeOnly, patternStr)) continue;

        issues.push({
          file: filepath,
          line: i + 1,
          severity,
          category: 'type-safety',
          message,
          suggestion,
          snippet: trimmed.slice(0, 80),
        });
      }
    }
  }

  return issues;
}
