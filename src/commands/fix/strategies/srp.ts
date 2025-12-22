/**
 * @module commands/fix/strategies/srp
 * @description Fix strategies for Single Responsibility Principle violations
 *
 * Handles:
 * - Too many exports (split file)
 * - Too many functions (group by purpose)
 * - Mixed concerns (separate types, utils, etc)
 */

import type { QualityIssue } from '../../quality/types';
import type { FixOperation, FixStrategy } from '../types';
import { splitFile } from '../ast-utils';

// ============================================================================
// SRP PATTERNS
// ============================================================================

const FIXABLE_PATTERNS = {
  EXPORTS: /(\d+)\s*exports/i,
  FUNCTIONS: /(\d+)\s*functions/i,
  MIXED: /mixed\s*concerns/i,
  SIZE: /(\d+)\s*lines/i,
};

/**
 * SRP fix strategy - splits files with too many responsibilities
 * Also handles 'size' issues (large files)
 */
export const srpStrategy: FixStrategy = {
  categories: ['srp', 'size'],

  canFix(issue: QualityIssue, _content: string): boolean {
    const { message, category } = issue;

    // Size issues - large files
    if (category === 'size' || FIXABLE_PATTERNS.SIZE.test(message)) {
      const match = message.match(/(\d+)\s*lines/i);
      const lines = match ? parseInt(match[1] || '0', 10) : 0;
      // Can split files between 400-2000 lines
      return lines >= 400 && lines <= 2000;
    }

    // Too many exports - can split
    if (FIXABLE_PATTERNS.EXPORTS.test(message)) {
      const match = message.match(/(\d+)\s*exports/i);
      const exports = match ? parseInt(match[1] || '0', 10) : 0;
      // Only split if there are many exports (>10) but not too many (manageable)
      return exports >= 10 && exports <= 50;
    }

    // Too many functions - can group
    if (FIXABLE_PATTERNS.FUNCTIONS.test(message)) {
      const match = message.match(/(\d+)\s*functions/i);
      const functions = match ? parseInt(match[1] || '0', 10) : 0;
      return functions >= 10 && functions <= 40;
    }

    return false;
  },

  generateFix(issue: QualityIssue, content: string): FixOperation | null {
    const { message, file, category } = issue;

    // Size or SRP issues -> split file
    if (category === 'size' ||
        FIXABLE_PATTERNS.SIZE.test(message) ||
        FIXABLE_PATTERNS.EXPORTS.test(message) ||
        FIXABLE_PATTERNS.FUNCTIONS.test(message)) {
      return generateSplitFix(content, file);
    }

    return null;
  },
};

// ============================================================================
// FIX GENERATORS
// ============================================================================

/**
 * Generate file split operation
 */
function generateSplitFix(content: string, file: string): FixOperation | null {
  // Try splitting by type first (types, functions, constants)
  const result = splitFile(content, file, { byType: true });

  if (!result.success || !result.files || result.files.length < 2) {
    // Try splitting by prefix if by-type didn't work
    const prefixResult = splitFile(content, file, { byPrefix: true });
    if (!prefixResult.success || !prefixResult.files) {
      return null;
    }
    return {
      action: 'split-file',
      file,
      newFiles: prefixResult.files,
    };
  }

  return {
    action: 'split-file',
    file,
    newFiles: result.files,
  };
}
