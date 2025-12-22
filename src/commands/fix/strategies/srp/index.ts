/**
 * @module commands/fix/strategies/srp
 * @description Fix strategy for Single Responsibility Principle violations
 *
 * Handles:
 * - Files with too many exports (splits by type/prefix)
 * - Files with too many functions (groups by purpose)
 * - Large files by line count
 *
 * Uses AST-based file splitting for safe transformations.
 */

import type { QualityIssue } from '../../../quality/types';
import type { FixOperation, FixStrategy } from '../../types';
import { matchNumberInRange, createSplitFile } from '../shared';
import { splitFile } from '../../ast-utils';
import {
  SRP_PATTERNS,
  SIZE_RANGE,
  EXPORTS_RANGE,
  FUNCTIONS_RANGE,
} from './constants';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if this is a size issue that we can fix
 */
function canFixSizeIssue(message: string, category: string): boolean {
  if (category === 'size' || SRP_PATTERNS.LINES.test(message)) {
    return matchNumberInRange(message, SRP_PATTERNS.LINES, SIZE_RANGE);
  }
  return false;
}

/**
 * Check if this is an exports issue that we can fix
 */
function canFixExportsIssue(message: string): boolean {
  return matchNumberInRange(message, SRP_PATTERNS.EXPORTS, EXPORTS_RANGE);
}

/**
 * Check if this is a functions issue that we can fix
 */
function canFixFunctionsIssue(message: string): boolean {
  return matchNumberInRange(message, SRP_PATTERNS.FUNCTIONS, FUNCTIONS_RANGE);
}

// ============================================================================
// FIX GENERATOR
// ============================================================================

/**
 * Generate file split operation using AST
 *
 * Tries splitting by type first (types, functions, constants),
 * then falls back to splitting by prefix (handle*, create*, etc).
 */
function generateSplitFix(
  content: string,
  file: string,
): FixOperation | null {
  // Try splitting by type first
  const byTypeResult = splitFile(content, file, { byType: true });

  if (byTypeResult.success && byTypeResult.files && byTypeResult.files.length >= 2) {
    return createSplitFile(file, byTypeResult.files);
  }

  // Fallback to splitting by prefix
  const byPrefixResult = splitFile(content, file, { byPrefix: true });

  if (byPrefixResult.success && byPrefixResult.files && byPrefixResult.files.length >= 2) {
    return createSplitFile(file, byPrefixResult.files);
  }

  return null;
}

// ============================================================================
// STRATEGY
// ============================================================================

/**
 * SRP fix strategy - splits files with too many responsibilities
 *
 * Also handles 'size' issues (large files by line count).
 */
export const srpStrategy: FixStrategy = {
  categories: ['srp', 'size'],

  canFix(issue: QualityIssue, _content: string): boolean {
    const { message, category } = issue;

    // Size issues - large files
    if (canFixSizeIssue(message, category)) {
      return true;
    }

    // Too many exports - can split
    if (canFixExportsIssue(message)) {
      return true;
    }

    // Too many functions - can group
    if (canFixFunctionsIssue(message)) {
      return true;
    }

    return false;
  },

  generateFix(issue: QualityIssue, content: string): FixOperation | null {
    const { message, file, category } = issue;

    if (!file) return null;

    // All SRP-related issues get the same treatment: split the file
    if (
      canFixSizeIssue(message, category) ||
      canFixExportsIssue(message) ||
      canFixFunctionsIssue(message)
    ) {
      return generateSplitFix(content, file);
    }

    return null;
  },
};

// Re-export for testing
export {
  SRP_PATTERNS,
  SIZE_RANGE,
  EXPORTS_RANGE,
  FUNCTIONS_RANGE,
} from './constants';
