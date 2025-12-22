/**
 * @module commands/review/patterns
 * @description Security and performance pattern checks
 */

import type { ReviewIssue, ReviewSeverity, ReviewCategory } from '../../types';

/**
 * Pattern definition
 */
export interface ReviewPattern {
  id: string;
  pattern: RegExp;
  category: ReviewCategory;
  severity: ReviewSeverity;
  message: string;
  suggestion?: string;
}

/**
 * Security patterns
 */
export const SECURITY_PATTERNS: ReviewPattern[] = [
  {
    id: 'eval',
    pattern: /\beval\s*\(/,
    category: 'security',
    severity: 'error',
    message: 'Use of eval() is potentially dangerous',
    suggestion: 'Use Function constructor or safer alternatives',
  },
  {
    id: 'innerHTML',
    pattern: /\.innerHTML\s*=/,
    category: 'security',
    severity: 'warning',
    message: 'innerHTML can lead to XSS vulnerabilities',
    suggestion: 'Use textContent or sanitize HTML',
  },
  {
    id: 'dangerouslySetInnerHTML',
    pattern: /dangerouslySetInnerHTML/,
    category: 'security',
    severity: 'warning',
    message: 'dangerouslySetInnerHTML should be used with caution',
    suggestion: 'Ensure HTML is properly sanitized',
  },
  {
    id: 'sql-injection',
    pattern: /\$\{.*\}.*sql|sql.*\$\{/i,
    category: 'security',
    severity: 'error',
    message: 'Potential SQL injection vulnerability',
    suggestion: 'Use parameterized queries',
  },
  {
    id: 'sensitive-data',
    pattern: /password|secret|api_key|apikey|auth_token/i,
    category: 'security',
    severity: 'info',
    message: 'Sensitive data handling - ensure proper encryption',
  },
  {
    id: 'env-var',
    pattern: /process\.env\.\w+/,
    category: 'security',
    severity: 'info',
    message: 'Environment variable usage - ensure it exists in all environments',
  },
];

/**
 * Performance patterns
 */
export const PERFORMANCE_PATTERNS: ReviewPattern[] = [
  {
    id: 'useEffect-no-deps',
    pattern: /useEffect\s*\(\s*\(\)\s*=>\s*\{[^}]*\}\s*\)/,
    category: 'performance',
    severity: 'warning',
    message: 'useEffect without dependencies array',
    suggestion: 'Add dependencies array or use empty array for mount-only effect',
  },
  {
    id: 'date-in-loop',
    pattern: /new Date\(\).*map|map.*new Date\(\)/,
    category: 'performance',
    severity: 'info',
    message: 'Creating Date objects in a loop can be slow',
  },
  {
    id: 'json-clone',
    pattern: /JSON\.parse.*JSON\.stringify/,
    category: 'performance',
    severity: 'info',
    message: 'Deep clone via JSON - consider structuredClone()',
  },
  {
    id: 'filter-map',
    pattern: /\.filter\(.*\)\.map\(/,
    category: 'performance',
    severity: 'info',
    message: 'Consider using .reduce() or .flatMap() for better performance',
  },
];

/**
 * Style patterns
 */
export const STYLE_PATTERNS: ReviewPattern[] = [
  {
    id: 'console-log',
    pattern: /console\.log\(/,
    category: 'style',
    severity: 'warning',
    message: 'Remove console.log before committing',
  },
  {
    id: 'debugger',
    pattern: /\bdebugger\b/,
    category: 'style',
    severity: 'error',
    message: 'Remove debugger statement',
  },
  {
    id: 'todo-comment',
    pattern: /TODO|FIXME|HACK|XXX/,
    category: 'style',
    severity: 'info',
    message: 'TODO/FIXME comment found',
  },
  {
    id: 'any-type',
    pattern: /:\s*any\s*[;,)>]/,
    category: 'style',
    severity: 'warning',
    message: 'Avoid using `any` type',
    suggestion: 'Use proper TypeScript types or unknown',
  },
  {
    id: 'eslint-disable',
    pattern: /eslint-disable/,
    category: 'style',
    severity: 'info',
    message: 'ESLint disable comment found',
  },
  {
    id: 'ts-ignore',
    pattern: /@ts-ignore|@ts-nocheck/,
    category: 'style',
    severity: 'warning',
    message: 'TypeScript ignore comment found',
    suggestion: 'Fix the type error instead of ignoring it',
  },
];

/**
 * All patterns combined
 */
export const ALL_PATTERNS: ReviewPattern[] = [...SECURITY_PATTERNS, ...PERFORMANCE_PATTERNS, ...STYLE_PATTERNS];

/**
 * Check content against patterns
 */
export function checkPatterns(content: string, patterns: ReviewPattern[] = ALL_PATTERNS): ReviewIssue[] {
  const issues: ReviewIssue[] = [];

  for (const { pattern, category, severity, message, suggestion } of patterns) {
    if (pattern.test(content)) {
      issues.push({
        file: '',
        severity,
        category,
        message,
        suggestion,
      });
    }
  }

  return issues;
}

/**
 * Analyze added lines in a diff
 */
export function analyzeAddedLines(diff: string, filepath: string): ReviewIssue[] {
  // Only analyze added lines (lines starting with + but not +++)
  const addedLines = diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));

  const content = addedLines.join('\n');
  const issues = checkPatterns(content);

  // Set file path for each issue
  return issues.map((issue) => ({ ...issue, file: filepath }));
}
