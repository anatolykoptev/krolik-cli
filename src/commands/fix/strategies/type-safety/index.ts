/**
 * @module commands/fix/strategies/type-safety
 * @description Fix strategy for TypeScript type-safety issues
 *
 * Handles:
 * - @ts-ignore comments (removes)
 * - @ts-nocheck comments (removes)
 * - Explicit 'any' types (replaces with 'unknown')
 *
 * Note: Non-null assertions (!) are NOT auto-fixed because
 * they require proper null checks which need context understanding.
 */

import type { QualityIssue } from '../../../quality/types';
import type { FixOperation, FixStrategy } from '../../types';
import { containsKeyword } from '../shared';
import { TYPE_SAFETY_KEYWORDS } from './constants';
import { fixTsIgnore, fixTsNocheck, fixAnyType } from './fixes';

// ============================================================================
// STRATEGY
// ============================================================================

/**
 * Type-safety fix strategy
 *
 * Only handles safe type-safety fixes:
 * - Removing suppression comments (@ts-ignore, @ts-nocheck)
 * - Converting 'any' to 'unknown'
 *
 * Does NOT handle:
 * - Non-null assertions (!) - requires null check logic
 * - Type assertions (as) - requires type understanding
 */
export const typeSafetyStrategy: FixStrategy = {
  categories: ['type-safety'],

  canFix(issue: QualityIssue, _content: string): boolean {
    const { message } = issue;

    return (
      containsKeyword(message, TYPE_SAFETY_KEYWORDS.TS_IGNORE) ||
      containsKeyword(message, TYPE_SAFETY_KEYWORDS.TS_NOCHECK) ||
      containsKeyword(message, TYPE_SAFETY_KEYWORDS.EXPLICIT_ANY)
    );
  },

  generateFix(issue: QualityIssue, content: string): FixOperation | null {
    const { message } = issue;

    if (containsKeyword(message, TYPE_SAFETY_KEYWORDS.TS_IGNORE)) {
      return fixTsIgnore(issue, content);
    }

    if (containsKeyword(message, TYPE_SAFETY_KEYWORDS.TS_NOCHECK)) {
      return fixTsNocheck(issue, content);
    }

    if (containsKeyword(message, TYPE_SAFETY_KEYWORDS.EXPLICIT_ANY)) {
      return fixAnyType(issue, content);
    }

    return null;
  },
};

// Re-export for testing
export { TYPE_SAFETY_KEYWORDS } from './constants';
export { fixTsIgnore, fixTsNocheck, fixAnyType } from './fixes';
