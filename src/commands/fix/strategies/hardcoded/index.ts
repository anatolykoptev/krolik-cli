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

import type { QualityIssue } from '../../types';
import type { FixOperation, FixStrategy } from '../../types';
import { FIXABLE_PATTERNS, ALLOWED_NUMBERS } from './constants';
import { looksLikeTimestamp } from './ast-utils';
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

// Re-export for external use
export { KNOWN_CONSTANTS, ALLOWED_NUMBERS, KEYWORD_TO_NAME } from './constants';
export { generateConstName } from './naming';
export { extractASTContext } from './ast-utils';
export { generateNumberFix, generateUrlFix } from './generators';
