/**
 * @module commands/refactor/analyzers/core/duplicates
 * @description AST-based duplicate function detection
 *
 * This file is a backward-compatible re-export barrel.
 * The actual implementation is split into focused modules under ./duplicates/
 */

// Re-export everything from the duplicates module
export {
  // Similarity calculation
  calculateGroupSimilarity,
  calculateSimilarity,
  // Linguistic utilities
  estimateSyllables,
  // Function extraction
  extractFunctions,
  type FindDuplicatesOptions,
  // Main public API
  findDuplicates,
  // File parsing
  findSourceFiles,
  // Constants
  GENERIC_STRUCTURAL_PATTERNS,
  getVowelRatio,
  // Normalization utilities
  hashBody,
  hasNounSuffix,
  hasVerbPrefix,
  isAbbreviation,
  // Name detection utilities
  isGenericFunctionName,
  isMeaningfulFunctionName,
  // Pattern detection utilities
  isPlaceholderName,
  isShortVerbPrefix,
  isSuffixOnlyName,
  normalizeBody,
  parseFilesWithSwc,
  parseFilesWithTsMorph,
  quickScanDuplicates,
  splitIntoSegments,
} from './duplicates/index';
