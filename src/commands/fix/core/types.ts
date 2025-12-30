/**
 * @module commands/fix/core/types
 * @description Core types for the fix command
 *
 * Re-exports all types from the split type files in core/types/
 */

// Re-export all types from the new split structure
export type {
  // Analysis
  FileAnalysis,
  // Fix
  FixAction,
  FixDifficulty,
  // Fixer
  Fixer,
  FixerContext,
  FixerMetadata,
  FixOperation,
  FixResult,
  FixStrategy,
  FunctionInfo,
  HardcodedValue,
  // Categories
  QualityCategory,
  QualityIssue,
  QualityReport,
  QualitySeverity,
  RecommendationItem,
  SplitSuggestion,
} from './types/index';
