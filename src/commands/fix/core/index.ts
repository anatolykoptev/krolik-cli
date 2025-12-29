/**
 * @module commands/fix/core
 * @description Core infrastructure for the Fixer architecture
 *
 * Exports:
 * - Types: QualityIssue, FixOperation, Fixer, FixerMetadata
 * - Registry: FixerRegistry, registry instance
 * - Options: FixOptions, QualityOptions
 * - Difficulty: getFixDifficulty, isTrivialFix
 * - Line utilities: splitLines, getLineContext, etc.
 * - Operations: createDeleteLine, createReplaceLine, etc.
 * - Pattern utilities: extractNumber, matchesAny, etc.
 */

// File cache (re-exported from unified lib/@cache)
export {
  FileCache,
  type FileCacheStats,
  fileCache,
  formatCacheStats,
} from '@/lib';
// Path utilities
export {
  type PathValidationResult,
  validatePathWithinProject,
} from '@/lib/@security/path';
// Conflict Detection
export {
  type Conflict,
  ConflictDetector,
  type ConflictOptions,
  type ConflictResolutionResult,
  type ConflictStats,
  type ConflictType,
  computePriority,
  detectAndResolve,
  detectConflictType,
  type IndexedOperation,
  type LineRange,
  normalizeRange,
  type OperationWithIssue,
  type Resolution,
  type ResolutionStrategy,
  rangeContains,
  rangesAdjacent,
  rangesIdentical,
  rangesOverlap,
  type SkippedOperation,
} from './conflict-detector';
// Difficulty
export {
  filterByDifficulty,
  getFixDifficulty,
  isSafeFix,
  isTrivialFix,
  sortByDifficulty,
} from './difficulty';
// Line utilities
export {
  clearLineCache,
  countLines,
  getCachedLines,
  getLineCacheStats,
  getLineContext,
  getLines,
  isComment,
  isEmptyLine,
  joinLines,
  type LineCacheStats,
  type LineContext,
  lineContains,
  lineEndsWith,
  lineStartsWith,
  splitLines,
} from './line-utils';
// Fix operations
export {
  createDeleteLine,
  createFullFileReplace,
  createReplaceLine,
  createReplaceRange,
  createSplitFile,
  isNoOp,
  withMetadata,
} from './operations';
// Options
export {
  DEFAULT_THRESHOLDS,
  type FixOptions,
  getEnabledFixerIds,
  hasExplicitFixerFlags,
  type QualityOptions,
  type ThresholdOverride,
  type Thresholds,
} from './options';
// Pattern utilities
export {
  containsKeyword,
  extractNumber,
  extractString,
  findMatchingPattern,
  inRange,
  matchesAll,
  matchesAny,
  matchNumberInRange,
  type NumberRange,
  type PatternMatch,
} from './pattern-utils';
// Registry
export {
  type CLIOption,
  createFixerMetadata,
  type FixerFilter,
  FixerRegistry,
  registry,
} from './registry';
// Runner
export {
  type FixerRunnerOptions,
  type FixerRunResult,
  getFixerSummary,
  runFixerAnalysis,
  runSafeFixers,
  runSpecificFixers,
  runTrivialFixers,
} from './runner';
// Types
export type {
  FileAnalysis,
  FixAction,
  FixDifficulty,
  Fixer,
  FixerMetadata,
  FixOperation,
  FixResult,
  FixStrategy,
  FunctionInfo,
  HardcodedValue,
  QualityCategory,
  QualityIssue,
  QualityReport,
  QualitySeverity,
  RecommendationItem,
  SplitSuggestion,
} from './types';
