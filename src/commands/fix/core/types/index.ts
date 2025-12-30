/**
 * @module commands/fix/core/types
 * @description Unified type exports for fix command
 *
 * Split by domain:
 * - categories.ts: QualityCategory, QualitySeverity
 * - analysis.ts: QualityIssue, FileAnalysis, FunctionInfo, etc.
 * - fix.ts: FixAction, FixOperation, FixResult, FixStrategy, FixDifficulty
 * - fixer.ts: Fixer, FixerMetadata, FixerContext
 */

// Analysis types
export type {
  FileAnalysis,
  FunctionInfo,
  HardcodedValue,
  QualityIssue,
  QualityReport,
  RecommendationItem,
  SplitSuggestion,
} from './analysis';
// Categories
export type { QualityCategory, QualitySeverity } from './categories';

// Fix types
export type {
  FixAction,
  FixDifficulty,
  FixOperation,
  FixResult,
  FixStrategy,
} from './fix';

// Fixer types
export type {
  Fixer,
  FixerContext,
  FixerMetadata,
} from './fixer';
