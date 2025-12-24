/**
 * @module commands/fix/strategies/complexity/nesting-fix
 * @description Fix generator for deep nesting issues
 */

import type { FixOperation } from '../../types';
import { reduceNesting } from '../../ast-utils/index';
import { createFullFileReplace } from '../shared';

// ============================================================================
// NESTING FIX
// ============================================================================

/**
 * Fix deep nesting with early returns
 *
 * Transforms:
 *   if (condition) {
 *     // lots of code
 *   }
 *
 * To:
 *   if (!condition) return;
 *   // lots of code
 *
 * @param content - File content
 * @param file - File path
 * @param targetLine - Optional target line number
 */
export function generateNestingFix(
  content: string,
  file: string,
  targetLine?: number,
): FixOperation | null {
  const result = reduceNesting(content, file, targetLine);

  if (!result.success || !result.newContent) {
    return null;
  }

  return createFullFileReplace(file, content, result.newContent);
}
