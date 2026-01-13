/**
 * @module commands/refactor/analyzers/core/swc-parser/shared
 * @description Shared utilities for SWC parsing - used by both function and type extraction
 *
 * Note: offsetToPosition is now imported from @/lib/@ast/swc
 */

import type { Span } from '@swc/core';

/**
 * Normalize SWC span to 0-based source offsets
 *
 * SWC spans are 1-based and accumulate across parse calls.
 * This function normalizes them using the baseOffset from parseFile.
 */
export function normalizeSpan(
  span: Span | undefined,
  content: string,
  baseOffset: number,
): { start: number; end: number } {
  const start = Math.max(0, (span?.start ?? 1) - baseOffset - 1);
  const end = Math.min(content.length, (span?.end ?? content.length + 1) - baseOffset - 1);
  return { start, end };
}

/**
 * Extract type text from type annotation node
 */
export function extractTypeText(
  typeAnnotation: unknown,
  content: string,
  baseOffset: number,
): string {
  if (!typeAnnotation || typeof typeAnnotation !== 'object') return 'unknown';

  const span = (typeAnnotation as { span?: Span }).span;
  if (!span) return 'unknown';

  // Normalize span using baseOffset, then convert SWC's 1-based to 0-based
  const start = Math.max(0, span.start - baseOffset - 1);
  const end = Math.min(content.length, span.end - baseOffset - 1);
  return content.slice(start, end);
}

/**
 * Normalize type text for comparison
 * - Removes import paths
 * - Removes whitespace
 * - Sorts union/intersection members
 */
export function normalizeTypeText(typeText: string): string {
  return (
    typeText
      // Remove import paths
      .replace(/import\([^)]+\)\./g, '')
      // Remove whitespace
      .replace(/\s+/g, '')
      // Sort union/intersection members
      .split(/[|&]/)
      .map((t) => t.trim())
      .sort()
      .join('|')
  );
}
