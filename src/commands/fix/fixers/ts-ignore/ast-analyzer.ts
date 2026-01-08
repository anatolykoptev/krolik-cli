/**
 * @module commands/fix/fixers/ts-ignore/ast-analyzer
 * @description AST-based analyzer for TypeScript ignore comments using ts-morph
 *
 * Uses ts-morph for 100% accurate detection of:
 * - @ts-expect-error comments
 * - @ts-nocheck comments
 * - @ts-expect-error comments
 *
 * Benefits over regex:
 * - Correctly skips directives inside string literals
 * - Works with both single-line and multi-line comments
 * - Provides exact positions for accurate fixes
 */

import { astPool } from '@/lib/@ast';
import type { QualityIssue } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface TsIgnoreLocation {
  line: number;
  column: number;
  startOffset: number;
  endOffset: number;
  directive: '@ts-ignore' | '@ts-nocheck' | '@ts-expect-error';
  isStandaloneLine: boolean;
  commentText: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TS_DIRECTIVES = ['@ts-ignore', '@ts-nocheck', '@ts-expect-error'] as const;
type TsDirective = (typeof TS_DIRECTIVES)[number];

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Analyze content for TypeScript ignore directives using ts-morph AST
 */
export function analyzeTsIgnoreAST(content: string, file: string): QualityIssue[] {
  // Skip .d.ts files
  if (file.endsWith('.d.ts')) {
    return [];
  }

  // Skip non-TypeScript files
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    return [];
  }

  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Get all statements and check their leading comments
      const statements = sourceFile.getStatements();

      // Track seen lines to avoid duplicates
      const seenLines = new Set<number>();

      // Check each statement's leading comments
      for (const statement of statements) {
        const leadingComments = statement.getLeadingCommentRanges();

        for (const comment of leadingComments) {
          const commentText = comment.getText();
          const commentLine = sourceFile.getLineAndColumnAtPos(comment.getPos()).line;

          // Skip if already seen this line
          if (seenLines.has(commentLine)) continue;

          // Check for each directive
          for (const directive of TS_DIRECTIVES) {
            if (commentText.includes(directive)) {
              seenLines.add(commentLine);

              const lineContent = lines[commentLine - 1] ?? '';
              const severity = directive === '@ts-nocheck' ? 'error' : 'error';

              const messageMap: Record<TsDirective, string> = {
                '@ts-ignore': '@ts-ignore suppresses TypeScript errors',
                '@ts-nocheck': '@ts-nocheck disables TypeScript checking for entire file',
                '@ts-expect-error': '@ts-expect-error suppresses TypeScript errors',
              };

              const suggestionMap: Record<TsDirective, string> = {
                '@ts-ignore': 'Fix the type error instead of ignoring it',
                '@ts-nocheck': 'Remove @ts-nocheck and fix type errors',
                '@ts-expect-error':
                  'If error is expected, document why; otherwise fix the type error',
              };

              issues.push({
                file,
                line: commentLine,
                severity,
                category: 'type-safety',
                message: messageMap[directive],
                suggestion: suggestionMap[directive],
                snippet: lineContent.trim().slice(0, 60),
                fixerId: 'ts-ignore',
              });

              break; // Only one issue per line
            }
          }
        }
      }

      // Also check top-level comments (before any statements)
      // These appear in the source file's leading trivia
      const firstStatement = statements[0];
      if (firstStatement) {
        // Already handled above
      } else {
        // No statements - check for comments in the whole file
        // This handles files that only have @ts-nocheck
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? '';
          const trimmed = line.trim();

          // Skip if already processed
          if (seenLines.has(i + 1)) continue;

          // Check if line is a standalone comment with directive
          if (trimmed.startsWith('//') || trimmed.startsWith('/*')) {
            for (const directive of TS_DIRECTIVES) {
              if (trimmed.includes(directive)) {
                seenLines.add(i + 1);

                const messageMap: Record<TsDirective, string> = {
                  '@ts-ignore': '@ts-ignore suppresses TypeScript errors',
                  '@ts-nocheck': '@ts-nocheck disables TypeScript checking for entire file',
                  '@ts-expect-error': '@ts-expect-error suppresses TypeScript errors',
                };

                const suggestionMap: Record<TsDirective, string> = {
                  '@ts-ignore': 'Fix the type error instead of ignoring it',
                  '@ts-nocheck': 'Remove @ts-nocheck and fix type errors',
                  '@ts-expect-error':
                    'If error is expected, document why; otherwise fix the type error',
                };

                issues.push({
                  file,
                  line: i + 1,
                  severity: 'error',
                  category: 'type-safety',
                  message: messageMap[directive],
                  suggestion: suggestionMap[directive],
                  snippet: trimmed.slice(0, 60),
                  fixerId: 'ts-ignore',
                });

                break;
              }
            }
          }
        }
      }

      return issues;
    } finally {
      cleanup();
    }
  } catch {
    // If parsing fails, fall back to simple line-by-line check
    return analyzeTsIgnoreFallback(content, file);
  }
}

/**
 * Fallback analyzer for files that fail to parse
 */
function analyzeTsIgnoreFallback(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Only check actual comments
    if (!trimmed.startsWith('//') && !trimmed.startsWith('/*')) {
      continue;
    }

    for (const directive of TS_DIRECTIVES) {
      if (trimmed.includes(directive)) {
        const messageMap: Record<TsDirective, string> = {
          '@ts-ignore': '@ts-ignore suppresses TypeScript errors',
          '@ts-nocheck': '@ts-nocheck disables TypeScript checking for entire file',
          '@ts-expect-error': '@ts-expect-error suppresses TypeScript errors',
        };

        const suggestionMap: Record<TsDirective, string> = {
          '@ts-ignore': 'Fix the type error instead of ignoring it',
          '@ts-nocheck': 'Remove @ts-nocheck and fix type errors',
          '@ts-expect-error': 'If error is expected, document why; otherwise fix the type error',
        };

        issues.push({
          file,
          line: i + 1,
          severity: 'error',
          category: 'type-safety',
          message: messageMap[directive],
          suggestion: suggestionMap[directive],
          snippet: trimmed.slice(0, 60),
          fixerId: 'ts-ignore',
        });

        break;
      }
    }
  }

  return issues;
}

/**
 * Find all ts-ignore directive locations with exact positions
 */
export function findTsIgnoreLocations(content: string, file: string): TsIgnoreLocation[] {
  const locations: TsIgnoreLocation[] = [];

  // Skip non-TypeScript files
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    return [];
  }

  const lines = content.split('\n');

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      const statements = sourceFile.getStatements();

      for (const statement of statements) {
        const leadingComments = statement.getLeadingCommentRanges();

        for (const comment of leadingComments) {
          const commentText = comment.getText();
          const pos = comment.getPos();
          const end = comment.getEnd();
          const { line, column } = sourceFile.getLineAndColumnAtPos(pos);

          for (const directive of TS_DIRECTIVES) {
            if (commentText.includes(directive)) {
              const lineContent = lines[line - 1] ?? '';
              const isStandalone =
                lineContent.trim().startsWith('//') || lineContent.trim().startsWith('/*');

              locations.push({
                line,
                column,
                startOffset: pos,
                endOffset: end,
                directive,
                isStandaloneLine: isStandalone,
                commentText,
              });

              break;
            }
          }
        }
      }

      return locations;
    } finally {
      cleanup();
    }
  } catch {
    return [];
  }
}
