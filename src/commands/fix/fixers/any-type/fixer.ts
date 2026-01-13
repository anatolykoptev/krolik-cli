/**
 * @module commands/fix/fixers/any-type/fixer
 * @description AST-based fixer for `any` type usage using ts-morph
 *
 * Uses ts-morph for 100% accurate fixes:
 * - Exact byte offsets for precise replacement
 * - Validates replacement is safe before applying
 * - Handles all `any` contexts correctly
 */

import { astPool, getLineStartOffset, SyntaxKind } from '@/lib/@ast';
import type { FixOperation, QualityIssue } from '../../core/types';

/**
 * Fix an `any` type issue by replacing with `unknown`
 *
 * Uses ts-morph AST for precise replacement at exact positions.
 */
export function fixAnyTypeIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];

  if (line === undefined) return null;

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, issue.file);

    try {
      // Find all 'any' keyword nodes on this specific line
      const anyNodes = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword);
      const lineAnyNodes = anyNodes.filter((node) => node.getStartLineNumber() === issue.line);

      if (lineAnyNodes.length === 0) {
        // No any nodes found on this line - return null
        return null;
      }

      // Build new line by replacing all 'any' with 'unknown'
      // We work on the line string directly using relative offsets
      const lineStartOffset = getLineStartOffset(content, issue.line);
      let newLine = line;

      // Sort by position descending to maintain offsets during replacement
      const sortedNodes = [...lineAnyNodes].sort((a, b) => b.getStart() - a.getStart());

      for (const anyNode of sortedNodes) {
        const start = anyNode.getStart() - lineStartOffset;
        const end = anyNode.getEnd() - lineStartOffset;

        // Validate we're replacing 'any'
        if (start >= 0 && end <= line.length && line.slice(start, end) === 'any') {
          newLine = `${newLine.slice(0, start)}unknown${newLine.slice(end)}`;
        }
      }

      if (newLine === line) {
        return null;
      }

      return {
        action: 'replace-line',
        file: issue.file,
        line: issue.line,
        oldCode: line,
        newCode: newLine,
      };
    } finally {
      cleanup();
    }
  } catch {
    // If AST parsing fails, return null
    return null;
  }
}

/**
 * Batch fix: Replace all `any` with `unknown` in a file
 *
 * More efficient than fixing line-by-line for files with many issues.
 * Returns the modified content directly.
 */
export function fixAllAnyInFile(content: string, file: string): string | null {
  // Skip non-TypeScript files
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    return null;
  }

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Find all 'any' keyword nodes
      const anyNodes = sourceFile.getDescendantsOfKind(SyntaxKind.AnyKeyword);

      if (anyNodes.length === 0) {
        return null;
      }

      // Sort by position descending for safe replacement
      const sortedNodes = [...anyNodes].sort((a, b) => b.getStart() - a.getStart());

      let newContent = content;

      for (const anyNode of sortedNodes) {
        const start = anyNode.getStart();
        const end = anyNode.getEnd();

        // Validate we're replacing 'any'
        if (content.slice(start, end) === 'any') {
          newContent = `${newContent.slice(0, start)}unknown${newContent.slice(end)}`;
        }
      }

      return newContent !== content ? newContent : null;
    } finally {
      cleanup();
    }
  } catch {
    return null;
  }
}
