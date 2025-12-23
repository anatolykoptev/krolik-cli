/**
 * @module commands/refine/types
 * @description Types for refine command (namespace structure analyzer)
 */

// ============================================================================
// NAMESPACE CATEGORIES
// ============================================================================

/**
 * Namespace category types
 * Following Clean Architecture layers
 */
export type NamespaceCategory =
  | 'core'         // Foundation: auth, config, utilities
  | 'domain'       // Business logic: data access, state
  | 'integrations' // External services: storage, APIs
  | 'ui'           // UI utilities: hooks, providers
  | 'utils'        // Shared utilities
  | 'seo'          // SEO: metadata, structured data
  | 'unknown';     // Uncategorized

/**
 * Namespace metadata
 */
export interface NamespaceInfo {
  category: NamespaceCategory;
  description: string;
  layer: string;
  dependsOn: string[];
  usedBy: string[];
}

// ============================================================================
// ANALYSIS TYPES
// ============================================================================

/**
 * Directory information from analysis
 */
export interface DirectoryInfo {
  /** Directory name (e.g., 'auth', '@core') */
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
  /** Suggested target namespace (if migration needed) */
  suggestedNamespace?: string;
  /** Module descriptions for subdirs */
  modules?: Record<string, string>;
}

/**
 * Migration plan for a single directory
 */
export interface MigrationMove {
  /** Source path (relative to lib) */
  from: string;
  /** Target path (relative to lib) */
  to: string;
  /** Reason for move */
  reason: string;
}

/**
 * Import update for migration
 */
export interface ImportUpdate {
  /** Old import path pattern */
  oldPath: string;
  /** New import path pattern */
  newPath: string;
}

/**
 * Complete migration plan
 */
export interface MigrationPlan {
  /** Directory moves */
  moves: MigrationMove[];
  /** Import path updates */
  importUpdates: ImportUpdate[];
  /** Organization score before/after */
  score: {
    before: number;
    after: number;
  };
}

/**
 * Full analysis result
 */
export interface RefineResult {
  /** Project root directory */
  projectRoot: string;
  /** Lib directory path (or null if not found) */
  libDir: string | null;
  /** Analyzed directories */
  directories: DirectoryInfo[];
  /** Current organization score (0-100) */
  currentScore: number;
  /** Potential score after migration */
  suggestedScore: number;
  /** Migration plan */
  plan: MigrationPlan;
  /** Timestamp of analysis */
  timestamp: string;
}

// ============================================================================
// COMMAND OPTIONS
// ============================================================================

/**
 * Refine command options
 */
export interface RefineOptions {
  /** Apply migration (move files, update imports) */
  apply?: boolean;
  /** Preview changes without applying */
  dryRun?: boolean;
  /** Generate ai-config.ts */
  generateConfig?: boolean;
  /** Output as JSON */
  json?: boolean;
  /** Output as markdown */
  markdown?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Custom lib path */
  libPath?: string;
}

// ============================================================================
// AI CONFIG TYPES
// ============================================================================

/**
 * Generated AI config namespace entry
 */
export interface AiNamespaceEntry {
  path: string;
  description: string;
  modules: Record<string, string>;
  dependsOn: string[];
  usedBy: string[];
}

/**
 * Generated AI config structure
 */
export interface AiConfig {
  namespaces: Record<string, AiNamespaceEntry>;
  quickReference: {
    newServerLogic: string;
    newClientHook: string;
    newUtility: string;
    newConstant: string;
    newIntegration: string;
  };
  imports: Record<string, string>;
  naming: Record<string, string>;
}
