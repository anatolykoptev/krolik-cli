/**
 * @module commands/refactor/analyzers/core/duplicates
 * @description AST-based duplicate function detection
 *
 * Split into focused modules for maintainability:
 * - constants.ts: Generic structural patterns
 * - linguistic.ts: Text analysis utilities
 * - patterns.ts: Placeholder and suffix-only detection
 * - name-detection.ts: Function name analysis
 * - normalization.ts: Body normalization
 * - extraction.ts: ts-morph function extraction
 * - parsing.ts: File parsing orchestration
 * - similarity.ts: Similarity calculations
 * - analyzer.ts: Main analysis functions
 */

export type { FindDuplicatesOptions } from './analyzer';
// Main public API
export { findDuplicates, quickScanDuplicates } from './analyzer';
// Constants
export { GENERIC_STRUCTURAL_PATTERNS } from './constants';
// Function extraction (for ts-morph)
export { extractFunctions } from './extraction';
// Linguistic utilities
export {
  estimateSyllables,
  getVowelRatio,
  hasNounSuffix,
  hasVerbPrefix,
  isAbbreviation,
  splitIntoSegments,
} from './linguistic';
// Name detection utilities
export { isGenericFunctionName, isMeaningfulFunctionName } from './name-detection';
// Normalization utilities
export { hashBody, normalizeBody } from './normalization';
// File parsing
export {
  findSourceFiles,
  parseFilesWithSwc,
  parseFilesWithTsMorph,
} from './parsing';
// Pattern detection utilities
export {
  isCommonCallbackPattern,
  isNextJsConventionPattern,
  isPlaceholderName,
  isShortVerbPrefix,
  isSuffixOnlyName,
} from './patterns';
// Similarity calculation
export { calculateGroupSimilarity, calculateSimilarity } from './similarity';
