/**
 * @module commands/fix/strategies/hardcoded
 * @description AST-based fix strategy for hardcoded values
 *
 * Uses ts-morph for safe code transformations:
 * - Magic numbers → Named constants
 * - URLs → Config constants
 *
 * Smart features:
 * - Extracts context from AST (property names, variable names)
 * - Skips numbers in const object literals (intentional mappings)
 * - Generates meaningful constant names from context
 * - Formats output with Prettier
 */

import type { FixOperation, FixStrategy, QualityIssue } from '../../core';
import { looksLikeTimestamp } from './ast-utils';
import { ALLOWED_NUMBERS, FIXABLE_PATTERNS } from './constants';
import { generateNumberFix, generateUrlFix } from './generators';

// ============================================================================
// STRATEGY
// ============================================================================

export const hardcodedStrategy: FixStrategy = {
  categories: ['hardcoded'],

  canFix(issue: QualityIssue, _content: string): boolean {
    const { message } = issue;

    if (FIXABLE_PATTERNS.NUMBER.test(message)) {
      const match = message.match(/(\d+)/);
      const value = match ? parseInt(match[1] || '0', 10) : 0;

      // Skip commonly acceptable numbers
      if (ALLOWED_NUMBERS.has(value)) return false;

      // Skip timestamps
      if (looksLikeTimestamp(value)) return false;

      // We CAN fix status codes - they should be constants
      // We CAN fix port numbers - they should be config

      return true;
    }

    if (FIXABLE_PATTERNS.URL.test(message)) {
      return true;
    }

    // Colors and text need theme/i18n systems
    return false;
  },

  async generateFix(issue: QualityIssue, content: string): Promise<FixOperation | null> {
    const { message, file, snippet } = issue;

    if (FIXABLE_PATTERNS.NUMBER.test(message)) {
      return generateNumberFix(content, file, message, snippet);
    }

    if (FIXABLE_PATTERNS.URL.test(message)) {
      return generateUrlFix(content, file, snippet);
    }

    return null;
  },
};

export { extractASTContext } from './ast-utils';
// Re-export for external use
export { ALLOWED_NUMBERS, KEYWORD_TO_NAME, KNOWN_CONSTANTS } from './constants';
export { generateNumberFix, generateUrlFix } from './generators';
export { generateConstName } from './naming';
