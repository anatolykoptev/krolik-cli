/**
 * @module lib/@patterns/hardcoded
 * @description Unified hardcoded value patterns - single source of truth (barrel export)
 *
 * Used by:
 * - quality/analyzers/hardcoded.ts (detection)
 * - fix/strategies/hardcoded (fixing)
 */

// Detection patterns and rules
export {
  DETECTION_PATTERNS,
  FIXABLE_PATTERNS,
  CONST_DECL_PATTERN,
  SKIP_FILE_PATTERNS,
  shouldSkipFile,
  shouldSkipLine,
} from './detection';

// Number-related patterns and helpers
export {
  ACCEPTABLE_NUMBERS,
  KNOWN_CONSTANTS,
  KEYWORD_TO_CONST_NAME,
  isAcceptableNumber,
  getKnownConstantName,
  getConstNameFromKeyword,
} from './numbers';

// URL-related patterns and helpers
export { SKIP_URL_PATTERNS, shouldSkipUrl } from './urls';
