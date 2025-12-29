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
  // Barrel
  BarrelExport,
  DirectoryInfo,
  // Duplicate detection
  DuplicateInfo,
  DuplicateLocation,
  FunctionSignature,
  // Migration
  MigrationAction,
  MigrationActionType,
  MigrationPlan,
  // Namespace
  NamespaceCategory,
  // Analysis
  RefactorAnalysis,
  RiskLevel,
  // Standards
  StandardCheck,
  StandardsCompliance,
  // Structure analysis
  StructureAnalysis,
  StructureIssue,
  StructureIssueType,
  TypeDuplicateInfo,
} from './types';

// ============================================================================
// AI-ENHANCED TYPES
// ============================================================================

export type {
  // Navigation
  AddNewCodeHints,
  AiNavigation,
  ArchHealth,
  ArchViolation,
  DomainInfo,
  EffortLevel,
  // Enhanced migration
  EnhancedMigrationAction,
  EnhancedMigrationPlan,
  // Enhanced analysis
  EnhancedRefactorAnalysis,
  EntryPoints,
  ExecutionStep,
  // Domains
  FileMoveInfo,
  FilePatternInfo,
  // File size analysis
  FileSizeAnalysis,
  FileSizeIssue,
  FileSizeSeverity,
  ImportConventions,
  LayerComplianceInfo,
  NamingConventions,
  ProjectContext,
  // Project context
  ProjectType,
  Recommendation,
  // Recommendations
  RecommendationCategory,
  // Reusable modules
  ReusabilityLevel,
  ReusableCategory,
  ReusableModuleSummary,
  ReusableModulesByCategory,
  ReusableModulesInfo,
  TechStack,
  // Architecture
  ViolationType,
} from './types-ai';

// ============================================================================
// OPTIONS
// ============================================================================

export type {
  AnalysisOptions,
  MigrationOptions,
  ModeAnalysisFlags,
  OutputFormat,
  RefactorMode,
  RefactorOptions,
} from './options';

export {
  DEFAULT_REFACTOR_OPTIONS,
  getModeFlags,
  mergeOptions,
  resolveMode,
} from './options';

// ============================================================================
// CONSTANTS
// ============================================================================

export {
  ALLOWED_DEPS,
  BOUNDARY_FILE_PATTERNS,
  detectCategory,
  getLayerNumber,
  isBoundaryFile,
  isDependencyAllowed,
  NAMESPACE_INFO,
  NAMESPACE_KEYWORDS,
} from './constants';

// ============================================================================
// TYPE MIGRATION
// ============================================================================

export type {
  CanonicalSelectionCriteria,
  ImportUpdateAction,
  TypeLocationInfo,
  TypeMigrationAction,
  TypeMigrationActionType,
  TypeMigrationExecutionOptions,
  TypeMigrationExecutionResult,
  TypeMigrationPlan,
  TypeMigrationPlanOptions,
  TypeMigrationResult,
} from './types-migration';

export { DEFAULT_CANONICAL_CRITERIA } from './types-migration';

// ============================================================================
// FILE CACHE
// ============================================================================

export { clearFileCache, type FindFilesOptions, getCachedFiles } from './file-cache';
