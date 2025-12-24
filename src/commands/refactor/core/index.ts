/**
 * @module commands/refactor/core
 * @description Core infrastructure for refactor command
 *
 * Exports:
 * - Types: DuplicateInfo, StructureAnalysis, MigrationPlan, RefactorAnalysis
 * - AI Types: ProjectContext, ArchHealth, EnhancedRefactorAnalysis
 * - Options: RefactorOptions, MigrationOptions
 * - Constants: NAMESPACE_KEYWORDS, NAMESPACE_INFO, ALLOWED_DEPS
 */

// ============================================================================
// BASE TYPES
// ============================================================================

export type {
  // Duplicate detection
  DuplicateInfo,
  FunctionSignature,
  TypeDuplicateInfo,
  // Structure analysis
  StructureAnalysis,
  StructureIssue,
  StructureIssueType,
  // Migration
  MigrationAction,
  MigrationActionType,
  MigrationPlan,
  RiskLevel,
  // Analysis
  RefactorAnalysis,
  // Barrel
  BarrelExport,
  // Namespace
  NamespaceCategory,
  DirectoryInfo,
  // Standards
  StandardCheck,
  StandardsCompliance,
} from './types';

// ============================================================================
// AI-ENHANCED TYPES
// ============================================================================

export type {
  // Project context
  ProjectType,
  TechStack,
  EntryPoints,
  ProjectContext,
  // Architecture
  ViolationType,
  ArchViolation,
  LayerComplianceInfo,
  ArchHealth,
  // Domains
  FileMoveInfo,
  DomainInfo,
  // Navigation
  AddNewCodeHints,
  FilePatternInfo,
  ImportConventions,
  NamingConventions,
  AiNavigation,
  // Recommendations
  RecommendationCategory,
  EffortLevel,
  Recommendation,
  // Enhanced migration
  EnhancedMigrationAction,
  ExecutionStep,
  EnhancedMigrationPlan,
  // Enhanced analysis
  EnhancedRefactorAnalysis,
} from './types-ai';

// ============================================================================
// OPTIONS
// ============================================================================

export type {
  OutputFormat,
  RefactorOptions,
  MigrationOptions,
  AnalysisOptions,
} from './options';

export {
  DEFAULT_REFACTOR_OPTIONS,
  mergeOptions,
} from './options';

// ============================================================================
// CONSTANTS
// ============================================================================

export {
  NAMESPACE_KEYWORDS,
  NAMESPACE_INFO,
  ALLOWED_DEPS,
  detectCategory,
  isDependencyAllowed,
  getLayerNumber,
} from './constants';

// ============================================================================
// TYPE MIGRATION
// ============================================================================

export type {
  TypeMigrationActionType,
  TypeMigrationAction,
  ImportUpdateAction,
  TypeMigrationPlan,
  TypeLocationInfo,
  CanonicalSelectionCriteria,
  TypeMigrationResult,
  TypeMigrationExecutionResult,
  TypeMigrationPlanOptions,
  TypeMigrationExecutionOptions,
} from './types-migration';

export {
  DEFAULT_CANONICAL_CRITERIA,
} from './types-migration';
