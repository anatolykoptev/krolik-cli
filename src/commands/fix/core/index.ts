/**
 * @module commands/fix/core
 * @description Core infrastructure for the Fixer architecture
 *
 * Exports:
 * - Types: QualityIssue, FixOperation, Fixer, FixerMetadata
 * - Registry: FixerRegistry, registry instance
 * - Options: FixOptions, QualityOptions
 * - Difficulty: getFixDifficulty, isTrivialFix
 */

// File cache (re-exported from unified lib/@cache)
export {
  FileCache,
  type FileCacheStats,
  fileCache,
  formatCacheStats,
} from '@/lib';
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
// Path utilities
export {
  type PathValidationResult,
  validatePathWithinProject,
} from './path-utils';
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
