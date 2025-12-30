/**
 * @module commands/refactor/core/types-ai
 * @description AI-enhanced types for refactor command
 *
 * Types for AI-native analysis: project context, architecture health,
 * domain classification, and enhanced migration planning.
 */

import type { RoutesOutput } from '../../routes';
// NOTE: Import from i18n.types.ts (not i18n.analyzer.ts) to avoid circular dependency
// (i18n.analyzer.ts imports registry which imports core which re-exports this file)
import type { I18nAnalysisResult } from '../analyzers/modules/i18n.types';
import type { RankingAnalysis } from '../analyzers/ranking/types';
import type { MigrationAction, MigrationPlan, NamespaceCategory, RefactorAnalysis } from './types';

// ============================================================================
// PROJECT CONTEXT
// ============================================================================

/**
 * Project type classification
 */
export type ProjectType = 'cli' | 'web-app' | 'api' | 'library' | 'monorepo' | 'mobile' | 'unknown';

/**
 * Tech stack detection result
 */
export interface TechStack {
  framework: string | null;
  runtime: 'node' | 'bun' | 'deno';
  language: 'typescript' | 'javascript';
  ui: string | null;
  stateManagement: string[];
  database: string[];
  testing: string[];
  styling: string[];
}

/**
 * Entry points in the project
 */
export interface EntryPoints {
  main: string | null;
  apiRoutes: string | null;
  pages: string | null;
  components: string | null;
  configs: string[];
  tests: string[];
}

/**
 * Project context for AI understanding
 */
export interface ProjectContext {
  type: ProjectType;
  name: string;
  techStack: TechStack;
  entryPoints: EntryPoints;
  importAlias: string | null;
  srcDir: string | null;
}

// ============================================================================
// ARCHITECTURE HEALTH
// ============================================================================

/**
 * Architecture violation types
 */
export type ViolationType = 'circular' | 'layer-violation' | 'cross-domain';

/**
 * Architecture violation
 */
export interface ArchViolation {
  type: ViolationType;
  severity: 'error' | 'warning' | 'info';
  from: string;
  to: string;
  message: string;
  fix: string;
}

/**
 * Layer compliance info
 */
export interface LayerComplianceInfo {
  expected: NamespaceCategory;
  actual: NamespaceCategory;
  compliant: boolean;
}

/**
 * Architecture health analysis
 */
export interface ArchHealth {
  score: number;
  violations: ArchViolation[];
  dependencyGraph: Record<string, string[]>;
  layerCompliance: Record<string, LayerComplianceInfo>;
}

// ============================================================================
// DOMAIN CLASSIFICATION
// ============================================================================

/**
 * File movement suggestion
 */
export interface FileMoveInfo {
  file: string;
  suggestedDomain: string;
}

/**
 * Domain classification for structure analysis
 */
export interface DomainInfo {
  name: string;
  path: string;
  category: NamespaceCategory;
  files: number;
  /** Coherence score 0-1 */
  coherence: number;
  /** Description of the domain */
  description: string;
  /** Suggested improvement */
  suggestion?: string;
  /** Files that belong here */
  belongsHere: string[];
  /** Files that should move elsewhere */
  shouldMove: FileMoveInfo[];
}

// ============================================================================
// AI NAVIGATION
// ============================================================================

/**
 * Where to add new code hints
 */
export interface AddNewCodeHints {
  serverLogic: string;
  clientHook: string;
  utility: string;
  constant: string;
  integration: string;
  component: string;
  apiRoute: string;
  test: string;
}

/**
 * File pattern information
 */
export interface FilePatternInfo {
  pattern: string;
  meaning: string;
  example: string;
}

/**
 * Import conventions
 */
export interface ImportConventions {
  absoluteImports: boolean;
  alias: string | null;
  barrelExports: boolean;
  preferredOrder: string[];
}

/**
 * Naming conventions
 */
export interface NamingConventions {
  files: string;
  components: string;
  hooks: string;
  utilities: string;
  constants: string;
  types: string;
}

/**
 * AI navigation hints
 */
export interface AiNavigation {
  addNewCode: AddNewCodeHints;
  filePatterns: FilePatternInfo[];
  importConventions: ImportConventions;
  namingConventions: NamingConventions;
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

/**
 * Recommendation category
 */
export type RecommendationCategory =
  | 'structure'
  | 'duplication'
  | 'architecture'
  | 'naming'
  | 'documentation';

/**
 * Effort level
 */
export type EffortLevel = 'low' | 'medium' | 'high';

/**
 * Actionable recommendation
 */
export interface Recommendation {
  id: string;
  priority: number;
  category: RecommendationCategory;
  title: string;
  description: string;
  /** Expected score improvement */
  expectedImprovement: number;
  /** Effort level */
  effort: EffortLevel;
  /** Affected files */
  affectedFiles: string[];
  /** Can be auto-fixed */
  autoFixable: boolean;
}

// ============================================================================
// ENHANCED MIGRATION
// ============================================================================

/**
 * Enhanced migration action with dependencies
 */
export interface EnhancedMigrationAction extends MigrationAction {
  /** Unique action ID */
  id: string;
  /** Execution order */
  order: number;
  /** Actions that must complete first */
  prerequisite: string[];
  /** Reason for this action */
  reason: string;
  /** Detailed affected files */
  affectedDetails: Array<{
    file: string;
    importCount: number;
  }>;
}

/**
 * Execution step
 */
export interface ExecutionStep {
  step: number;
  actionId: string;
  canParallelize: boolean;
}

/**
 * Enhanced migration plan with ordering
 */
export interface EnhancedMigrationPlan extends MigrationPlan {
  actions: EnhancedMigrationAction[];
  /** Execution steps in order */
  executionOrder: ExecutionStep[];
  /** Safe rollback points */
  rollbackPoints: string[];
}

// ============================================================================
// REUSABLE MODULES
// ============================================================================

/**
 * Reusable module category
 */
export type ReusableCategory =
  | 'ui-component'
  | 'hook'
  | 'utility'
  | 'type'
  | 'schema'
  | 'service'
  | 'constant'
  | 'context'
  | 'hoc'
  | 'model'
  | 'unknown';

/**
 * Reusability level
 */
export type ReusabilityLevel = 'core' | 'high' | 'medium' | 'low' | 'none';

/**
 * Summary of a reusable module for AI output
 */
export interface ReusableModuleSummary {
  /** Relative path */
  path: string;
  /** Module name */
  name: string;
  /** Category */
  category: ReusableCategory;
  /** Reusability level */
  level: ReusabilityLevel;
  /** Reusability score (0-100) */
  score: number;
  /** Number of exports */
  exportCount: number;
  /** Number of files importing this module */
  importedByCount: number;
  /** Description if available */
  description?: string;
}

/**
 * Reusable modules grouped by category
 */
export interface ReusableModulesByCategory {
  'ui-component': ReusableModuleSummary[];
  hook: ReusableModuleSummary[];
  utility: ReusableModuleSummary[];
  type: ReusableModuleSummary[];
  schema: ReusableModuleSummary[];
  service: ReusableModuleSummary[];
  constant: ReusableModuleSummary[];
  context: ReusableModuleSummary[];
  hoc: ReusableModuleSummary[];
  model: ReusableModuleSummary[];
  unknown: ReusableModuleSummary[];
}

/**
 * Reusable modules analysis result
 */
export interface ReusableModulesInfo {
  /** Total reusable modules found */
  totalModules: number;
  /** Total exports across all modules */
  totalExports: number;
  /** Modules grouped by category */
  byCategory: ReusableModulesByCategory;
  /** Top reusable modules (core + high) */
  topModules: ReusableModuleSummary[];
  /** Scan duration in ms */
  scanDurationMs: number;
}

// ============================================================================
// FILE SIZE ANALYSIS
// ============================================================================

/**
 * File size severity level
 */
export type FileSizeSeverity = 'warning' | 'error' | 'critical';

/**
 * File size issue
 */
export interface FileSizeIssue {
  /** Relative file path */
  file: string;
  /** Lines of code */
  lines: number;
  /** Severity based on lines count */
  severity: FileSizeSeverity;
  /** Suggested action */
  suggestion: string;
  /** Estimated split count */
  suggestedSplitCount: number;
}

/**
 * File size analysis result
 */
export interface FileSizeAnalysis {
  /** Total files analyzed */
  totalFiles: number;
  /** Files with issues */
  issues: FileSizeIssue[];
  /** Thresholds used */
  thresholds: {
    warning: number;
    error: number;
    critical: number;
  };
  /** Summary by severity */
  summary: {
    warning: number;
    error: number;
    critical: number;
  };
}

// ============================================================================
// ENHANCED ANALYSIS
// ============================================================================

/**
 * Enhanced refactor analysis with AI features
 */
export interface EnhancedRefactorAnalysis extends RefactorAnalysis {
  /** Project context */
  projectContext: ProjectContext;
  /** Architecture health */
  archHealth: ArchHealth;
  /** Domain classification */
  domains: DomainInfo[];
  /** AI navigation hints */
  aiNavigation: AiNavigation;
  /** Enhanced migration plan */
  enhancedMigration: EnhancedMigrationPlan;
  /** Prioritized recommendations */
  recommendations: Recommendation[];
  /** Reusable modules analysis */
  reusableModules?: ReusableModulesInfo;
  /** File size analysis */
  fileSizeAnalysis?: FileSizeAnalysis;
  /** PageRank-based ranking analysis (hotspots, coupling, safe order) */
  rankingAnalysis?: RankingAnalysis;
  /** I18n hardcoded strings analysis (deep mode only) */
  i18nAnalysis?: I18nAnalysisResult;
  /** API routes analysis (deep mode only) */
  apiAnalysis?: RoutesOutput;
}
