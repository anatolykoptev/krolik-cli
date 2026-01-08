/**
 * @module commands/fix/fixers/ts-ignore/ast-fixer
 * @description AST-based fixer for TypeScript ignore comments
 *
 * Uses ts-morph for accurate comment position detection and removal.
 * Handles both standalone and inline @ts-expect-error/@ts-nocheck/@ts-expect-error.
 */

import { astPool } from '@/lib/@ast';
import type { FixOperation, QualityIssue } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

interface CommentLocation {
  startOffset: number;
  endOffset: number;
  isStandalone: boolean;
  lineNumber: number;
  fullLineStart: number;
  fullLineEnd: number;
}

// ============================================================================
// FIXER
// ============================================================================

/**
 * Fix ts-ignore issues using AST for accurate positioning
 */
export function fixTsIgnoreAST(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');
  const targetLine = lines[issue.line - 1];
  if (!targetLine) return null;

  // Skip non-TypeScript files
  if (!issue.file.endsWith('.ts') && !issue.file.endsWith('.tsx')) {
    return null;
  }

  // Skip .d.ts files
  if (issue.file.endsWith('.d.ts')) {
    return null;
  }

  // Find the exact comment location using AST
  const location = findCommentLocation(content, issue.file, issue.line);

  if (!location) {
    // Fallback: use line-based detection
    return fixTsIgnoreFallback(issue, content);
  }

  if (location.isStandalone) {
    // Delete the entire line
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: targetLine,
    };
  }

  // Inline comment - remove just the comment part
  const beforeComment = content.slice(0, location.startOffset);
  const afterComment = content.slice(location.endOffset);

  // Find where the line starts in the content
  let lineStart = 0;
  for (let i = 0; i < issue.line - 1; i++) {
    lineStart += (lines[i]?.length ?? 0) + 1; // +1 for newline
  }
  const lineEnd = lineStart + targetLine.length;

  // Extract the new line content
  const newLineContent = (
    beforeComment.slice(lineStart) + afterComment.slice(0, lineEnd - location.endOffset)
  ).trim();

  // If removing the comment leaves only whitespace, delete the line
  if (newLineContent.length === 0) {
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: targetLine,
    };
  }

  // Replace with cleaned line
  const newLine = targetLine
    .replace(/\/\/\s*@ts-(ignore|nocheck|expect-error)[^\n]*/g, '')
    .replace(/\/\*\s*@ts-(ignore|nocheck|expect-error)\s*\*\//g, '')
    .trimEnd();

  if (newLine !== targetLine) {
    return {
      action: 'replace-line',
      file: issue.file,
      line: issue.line,
      oldCode: targetLine,
      newCode: newLine,
    };
  }

  return null;
}

/**
 * Find the exact location of a comment containing a ts directive at a given line
 */
function findCommentLocation(
  content: string,
  file: string,
  targetLineNumber: number,
): CommentLocation | null {
  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      const lines = content.split('\n');
      const statements = sourceFile.getStatements();

      // Check each statement's leading comments
      for (const statement of statements) {
        const leadingComments = statement.getLeadingCommentRanges();

        for (const comment of leadingComments) {
          const commentText = comment.getText();
          const pos = comment.getPos();
          const end = comment.getEnd();
          const { line } = sourceFile.getLineAndColumnAtPos(pos);

          if (line !== targetLineNumber) continue;

          // Check if this comment contains a ts directive
          if (
            commentText.includes('@ts-ignore') ||
            commentText.includes('@ts-nocheck') ||
            commentText.includes('@ts-expect-error')
          ) {
            const lineContent = lines[line - 1] ?? '';
            const trimmed = lineContent.trim();
            const isStandalone =
              trimmed.startsWith('//') &&
              (trimmed.includes('@ts-ignore') ||
                trimmed.includes('@ts-nocheck') ||
                trimmed.includes('@ts-expect-error'));

            // Calculate line boundaries
            let fullLineStart = 0;
            for (let i = 0; i < line - 1; i++) {
              fullLineStart += (lines[i]?.length ?? 0) + 1;
            }
            const fullLineEnd = fullLineStart + lineContent.length;

            return {
              startOffset: pos,
              endOffset: end,
              isStandalone,
              lineNumber: line,
              fullLineStart,
              fullLineEnd,
            };
          }
        }
      }

      return null;
    } finally {
      cleanup();
    }
  } catch {
    return null;
  }
}

/**
 * Fallback fixer for files that fail AST parsing
 */
function fixTsIgnoreFallback(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');
  const line = lines[issue.line - 1];
  if (!line) return null;

  // Standalone line patterns
  const standalonePatterns = [
    /^\s*\/\/\s*@ts-(ignore|nocheck|expect-error)/,
    /^\s*\/\*\s*@ts-(ignore|nocheck|expect-error)\s*\*\/\s*$/,
  ];

  const isStandalone = standalonePatterns.some((p) => p.test(line));

  if (isStandalone) {
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  // Inline - remove the comment part
  const newLine = line
    .replace(/\/\/\s*@ts-(ignore|nocheck|expect-error)[^\n]*/g, '')
    .replace(/\/\*\s*@ts-(ignore|nocheck|expect-error)\s*\*\//g, '')
    .trimEnd();

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
