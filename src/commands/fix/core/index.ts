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

// Types
export type {
  QualitySeverity,
  QualityCategory,
  QualityIssue,
  FixAction,
  FixOperation,
  FixResult,
  FixDifficulty,
  FixerMetadata,
  Fixer,
  FixStrategy,
  SplitSuggestion,
  FunctionInfo,
  FileAnalysis,
  HardcodedValue,
  RecommendationItem,
  QualityReport,
} from './types';

// Registry
export {
  FixerRegistry,
  registry,
  createFixerMetadata,
  type CLIOption,
  type FixerFilter,
} from './registry';

// Options
export {
  type Thresholds,
  DEFAULT_THRESHOLDS,
  type ThresholdOverride,
  type QualityOptions,
  type FixOptions,
  hasExplicitFixerFlags,
  getEnabledFixerIds,
} from './options';

// Difficulty
export {
  getFixDifficulty,
  isTrivialFix,
  isSafeFix,
  filterByDifficulty,
  sortByDifficulty,
} from './difficulty';

// Runner
export {
  runFixerAnalysis,
  runTrivialFixers,
  runSafeFixers,
  runSpecificFixers,
  getFixerSummary,
  type FixerRunnerOptions,
  type FixerRunResult,
} from './runner';

// Path utilities
export {
  validatePathWithinProject,
  type PathValidationResult,
} from './path-utils';

// File cache
export {
  FileCache,
  fileCache,
  formatCacheStats,
  type FileCacheStats,
} from './file-cache';
