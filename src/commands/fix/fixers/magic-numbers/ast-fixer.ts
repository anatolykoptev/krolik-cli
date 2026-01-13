/**
 * @module commands/fix/fixers/magic-numbers/ast-fixer
 * @description AST-based fixer for magic numbers
 *
 * Extracts magic numbers to named constants using ts-morph.
 * The fixer:
 * - Generates semantic constant names based on context
 * - Inserts const declarations at the top of the file
 * - Replaces the magic number with the constant reference
 */

import { SyntaxKind } from 'ts-morph';
import { astPool } from '@/lib/@ast';
import type { FixOperation, QualityIssue } from '../../core/types';
import { findInsertionLine } from '../../core/utils';

// ============================================================================
// FIXER
// ============================================================================

/**
 * Fix magic number issues using AST for accurate positioning
 */
export function fixMagicNumberAST(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  // Skip non-TypeScript files
  if (!issue.file.endsWith('.ts') && !issue.file.endsWith('.tsx')) {
    return null;
  }

  // Extract the number from the message
  const numMatch = issue.message.match(/(\d+)/);
  if (!numMatch?.[1]) return null;

  const targetNumber = parseInt(numMatch[1], 10);
  const lines = content.split('\n');
  const targetLine = lines[issue.line - 1];
  if (!targetLine) return null;

  // Generate constant name based on context
  const constName = generateConstantName(targetNumber, targetLine);

  // Find the exact position of the number using AST
  const position = findNumberPosition(content, issue.file, issue.line, targetNumber);

  if (position) {
    // Insert const at file start (after imports) and replace the number
    const insertLine = findInsertionLine(content, issue.file);
    const constDeclaration = `const ${constName} = ${targetNumber};`;

    // Build new content
    const newLines = [...lines];

    // Replace the magic number with the constant name
    const lineIndex = issue.line - 1;
    const lineContent = newLines[lineIndex] ?? '';
    const regex = new RegExp(`\\b${targetNumber}\\b`);
    newLines[lineIndex] = lineContent.replace(regex, constName);

    // Insert the constant declaration
    newLines.splice(insertLine, 0, constDeclaration);

    return {
      action: 'replace-range',
      file: issue.file,
      line: 1,
      endLine: lines.length,
      oldCode: content,
      newCode: newLines.join('\n'),
    };
  }

  // Fallback: simple line-based fix
  return fixMagicNumberFallback(issue, content, targetNumber, constName);
}

/**
 * Generate a semantic constant name based on context
 */
function generateConstantName(value: number, lineContext: string): string {
  const lower = lineContext.toLowerCase();

  // Time-related
  if (/timeout|delay|interval|duration/.test(lower)) {
    if (value >= 1000 && value % 1000 === 0) {
      return `TIMEOUT_${value / 1000}S`;
    }
    return `TIMEOUT_${value}MS`;
  }

  // Size-related
  if (/width|height|size|dimension/.test(lower)) {
    return `SIZE_${value}`;
  }

  // Limits
  if (/max|maximum|limit/.test(lower)) {
    return `MAX_${value}`;
  }
  if (/min|minimum/.test(lower)) {
    return `MIN_${value}`;
  }

  // Count/length
  if (/count|length|total/.test(lower)) {
    return `COUNT_${value}`;
  }

  // Retry/attempts
  if (/retry|retries|attempt/.test(lower)) {
    return `MAX_RETRIES_${value}`;
  }

  // Page/pagination
  if (/page|offset|limit/.test(lower)) {
    return `PAGE_SIZE_${value}`;
  }

  // Buffer/chunk
  if (/buffer|chunk/.test(lower)) {
    return `BUFFER_SIZE_${value}`;
  }

  // Threshold
  if (/threshold|score/.test(lower)) {
    return `THRESHOLD_${value}`;
  }

  // Index
  if (/index|position/.test(lower)) {
    return `INDEX_${value}`;
  }

  // Default naming
  return `MAGIC_NUMBER_${value}`;
}

/**
 * Find the exact position of a number in the AST at a specific line
 */
function findNumberPosition(
  content: string,
  file: string,
  targetLine: number,
  targetValue: number,
): { start: number; end: number } | null {
  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      const numericLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.NumericLiteral);

      for (const literal of numericLiterals) {
        const value = literal.getLiteralValue();
        const { line } = sourceFile.getLineAndColumnAtPos(literal.getStart());

        if (line === targetLine && value === targetValue) {
          return {
            start: literal.getStart(),
            end: literal.getEnd(),
          };
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
 * Fallback fixer using simple string operations
 */
function fixMagicNumberFallback(
  issue: QualityIssue,
  content: string,
  targetNumber: number,
  constName: string,
): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];
  if (!line) return null;

  // Find insert position (after imports)
  let insertLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] ?? '';
    if (l.trim().startsWith('import ')) {
      insertLine = i + 1;
    }
  }

  // Create the fix
  const constDeclaration = `const ${constName} = ${targetNumber};`;
  const newLines = [...lines];

  // Replace the number with constant name
  const regex = new RegExp(`\\b${targetNumber}\\b`);
  newLines[lineIndex] = line.replace(regex, constName);

  // Insert const declaration
  newLines.splice(insertLine, 0, constDeclaration);

  return {
    action: 'replace-range',
    file: issue.file,
    line: 1,
    endLine: lines.length,
    oldCode: content,
    newCode: newLines.join('\n'),
  };
}
