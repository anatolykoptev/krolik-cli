/**
 * @module commands/fix/strategies/complexity/long-function-fix
 * @description Fix generator for long function issues
 */

import { extractFunction } from '../../ast-utils/index';
import type { FixOperation } from '../../core';
import { createFullFileReplace, splitLines, withMetadata } from '../../core';
import { findExtractionRange, findFunctionEnd, generateFunctionName } from './helpers';

// ============================================================================
// LONG FUNCTION FIX
// ============================================================================

/**
 * Fix long functions by extracting logical blocks
 *
 * Identifies self-contained blocks (if, for, while, try) and extracts
 * them into separate functions. Falls back to extracting the middle
 * portion if no clear blocks are found.
 *
 * @param content - File content
 * @param file - File path
 * @param startLine - Function start line number
 */
export function generateLongFunctionFix(
  content: string,
  file: string,
  startLine?: number,
): FixOperation | null {
  if (!startLine) return null;

  const lines = splitLines(content);

  // Find function boundaries
  const functionEnd = findFunctionEnd(lines, startLine);
  if (!functionEnd) return null;

  // Find a good extraction point
  const extractionRange = findExtractionRange(lines, startLine, functionEnd);
  if (!extractionRange) return null;

  // Determine if function is async
  const funcLine = lines[startLine - 1] ?? '';
  const isAsync = funcLine.includes('async');

  // Generate a meaningful name based on content
  const blockContent = lines.slice(extractionRange.start - 1, extractionRange.end).join('\n');
  const functionName = generateFunctionName(blockContent);

  // Extract the function
  const result = extractFunction(content, file, {
    startLine: extractionRange.start,
    endLine: extractionRange.end,
    functionName,
    isAsync,
  });

  if (!result.success || !result.newContent) {
    return null;
  }

  const operation = createFullFileReplace(file, content, result.newContent);

  return withMetadata(operation, { functionName });
}
