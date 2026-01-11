/**
 * @module commands/refactor/core/types
 * @description Base types for refactor command
 *
 * Core types for duplicate detection, structure analysis, and migration planning.
 */

// ============================================================================
// DUPLICATE DETECTION
// ============================================================================

/**
 * Location of a duplicate function/export
 */
export interface DuplicateLocation {
  file: string;
  line: number;
  exported: boolean;
}

/**
 * Detected duplicate function/export
 */
export interface DuplicateInfo {
  /** Function/export name */
  name: string;
  /** File locations where found */
  locations: DuplicateLocation[];
  /** Similarity score 0-1 (1 = identical) */
  similarity: number;
  /** Recommendation */
  recommendation: 'merge' | 'rename' | 'keep-both';
}

/**
 * Function signature extracted from AST
 */
export interface FunctionSignature {
  name: string;
  file: string;
  line: number;
  params: string[];
  returnType: string;
  exported: boolean;
  /** Hash of function body for similarity comparison */
  bodyHash: string;
  /** Simplified body for comparison */
  normalizedBody: string;
  /** Cached tokens for similarity calculation */
  tokens?: Set<string>;
  /** Structural fingerprint for clone detection (catches renamed clones) */
  fingerprint?: string;
  /** Structural complexity score */
  complexity?: number;
  /** Whether function is async */
  isAsync?: boolean;
  /** Number of parameters (for architectural pattern detection) */
  paramCount?: number;
}

// ============================================================================
// STRUCTURE ANALYSIS
// ============================================================================

/**
 * Module structure analysis result
 */
export interface StructureAnalysis {
  /** Flat files at lib root */
  flatFiles: string[];
  /** Namespaced folders (@something) */
  namespacedFolders: string[];
  /** Double-nested folders (@something vs @something) */
  doubleNested: string[];
  /** Files that should be grouped */
  ungroupedFiles: Array<{
    file: string;
    suggestedNamespace: string;
  }>;
  /** Overall structure score 0-100 */
  score: number;
  /** Issues found */
  issues: StructureIssue[];
}

/**
 * Structure issue types
 */
export type StructureIssueType =
  | 'double-nesting'
  | 'mixed-structure'
  | 'duplicate-module'
  | 'missing-barrel'
  | 'inconsistent-naming';

/**
 * Structure issue
 */
export interface StructureIssue {
  type: StructureIssueType;
  severity: 'error' | 'warning' | 'info';
  message: string;
  files: string[];
  fix?: string;
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Migration action types
 */
export type MigrationActionType = 'move' | 'merge' | 'delete' | 'create-barrel' | 'update-imports';

/**
 * Risk level for migration actions
 */
export type RiskLevel = 'safe' | 'medium' | 'risky';

/**
 * Migration action
 */
export interface MigrationAction {
  type: MigrationActionType;
  source: string;
  target?: string;
  /** Files that import the source and need updating */
  affectedImports: string[];
  /** Estimated risk level */
  risk: RiskLevel;
}

/**
 * Migration plan
 */
export interface MigrationPlan {
  actions: MigrationAction[];
  /** Total files affected */
  filesAffected: number;
  /** Imports that will be updated */
  importsToUpdate: number;
  /** Risk summary */
  riskSummary: {
    safe: number;
    medium: number;
    risky: number;
  };
}

// ============================================================================
// REFACTOR ANALYSIS
// ============================================================================

/**
 * Duplicate type/interface info
 */
export interface TypeDuplicateInfo {
  /** Type name (or combined names for identical structures) */
  name: string;
  /** Kind of type */
  kind: 'interface' | 'type' | 'mixed';
  /** Locations where duplicates found */
  locations: Array<{
    file: string;
    line: number;
    exported: boolean;
    name: string;
  }>;
  /** Structural similarity (0-1) */
  similarity: number;
  /** Recommendation */
  recommendation: 'merge' | 'rename' | 'keep-both';
  /** Common fields (for interfaces) */
  commonFields?: string[];
  /** Difference description */
  difference?: string;
}

/**
 * Resolved paths for refactor analysis
 */
export interface ResolvedPaths {
  /** Absolute path to analyze */
  targetPath: string;
  /** Absolute path to lib directory (for migrations) */
  libPath: string;
  /** Relative path for display */
  relativePath: string;
}

/**
 * Refactor analysis result
 */
export interface RefactorAnalysis {
  /** Path analyzed (relative) */
  path: string;
  /** Absolute path to lib directory (for migrations) */
  libPath: string;
  /** Duplicate functions found */
  duplicates: DuplicateInfo[];
  /** Duplicate types/interfaces found */
  typeDuplicates?: TypeDuplicateInfo[];
  /** Structure analysis */
  structure: StructureAnalysis;
  /** Suggested migration plan */
  migration: MigrationPlan;
  /** Analysis timestamp */
  timestamp: string;
}

// ============================================================================
// BARREL EXPORTS
// ============================================================================

/**
 * Export info from barrel file
 */
export interface BarrelExport {
  name: string;
  source: string;
  type: 'named' | 'default' | 'namespace';
}

// ============================================================================
// NAMESPACE TYPES
// ============================================================================

/**
 * Namespace category for Clean Architecture
 */
export type NamespaceCategory =
  | 'core'
  | 'domain'
  | 'integrations'
  | 'ui'
  | 'utils'
  | 'seo'
  | 'unknown';

/**
 * Directory info for namespace analysis
 */
export interface DirectoryInfo {
  /** Directory name */
  name: string;
  /** Relative path from lib root */
  path: string;
  /** Number of TypeScript files */
  fileCount: number;
  /** Subdirectory names */
  subdirs: string[];
  /** Detected category */
  category: NamespaceCategory;
  /** Is already using @namespace pattern */
  isNamespaced: boolean;
  /** Suggested target namespace */
  suggestedNamespace?: string;
}

// ============================================================================
// STANDARDS COMPLIANCE
// ============================================================================

/**
 * Standard check result
 */
export interface StandardCheck {
  name: string;
  description: string;
  passed: boolean;
  details: string;
  autoFixable: boolean;
}

/**
 * Standards compliance report
 */
export interface StandardsCompliance {
  /** Overall compliance percentage */
  score: number;
  /** Individual checks */
  checks: StandardCheck[];
  /** Categories summary */
  categories: {
    structure: number;
    naming: number;
    dependencies: number;
    documentation: number;
  };
}
