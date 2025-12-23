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

// ============================================================================
// PROJECT CONTEXT
// ============================================================================

/**
 * Detected project type
 */
export type ProjectType =
  | 'cli'           // Command-line tool
  | 'web-app'       // Next.js/React web application
  | 'api'           // Backend API service
  | 'library'       // Reusable library/package
  | 'monorepo'      // Multi-package workspace
  | 'mobile'        // React Native/Expo app
  | 'unknown';

/**
 * Tech stack detection
 */
export interface TechStack {
  framework: string | null;     // next, express, fastify, etc.
  runtime: string;              // node, bun, deno
  language: 'typescript' | 'javascript';
  ui: string | null;            // react, vue, svelte, etc.
  stateManagement: string[];    // zustand, redux, jotai, etc.
  database: string[];           // prisma, drizzle, mongoose, etc.
  testing: string[];            // vitest, jest, playwright, etc.
  styling: string[];            // tailwind, styled-components, etc.
}

/**
 * Project entry points for AI navigation
 */
export interface EntryPoints {
  /** Main entry file */
  main: string | null;
  /** API routes directory */
  apiRoutes: string | null;
  /** Pages/app directory */
  pages: string | null;
  /** Components directory */
  components: string | null;
  /** Configuration files */
  configs: string[];
  /** Test directories */
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
  /** Import alias (e.g., "@/", "~/") */
  importAlias: string | null;
  /** Source directory (e.g., "src", "app") */
  srcDir: string | null;
}

// ============================================================================
// ARCHITECTURE HEALTH
// ============================================================================

/**
 * Dependency violation types
 */
export type ViolationType =
  | 'circular'              // Circular dependency
  | 'layer-violation'       // Lower layer importing higher layer
  | 'cross-domain'          // Domain A importing Domain B internals
  | 'ui-in-core'            // UI code in core layer
  | 'business-in-ui';       // Business logic in UI layer

/**
 * Single architecture violation
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
 * Architecture health metrics
 */
export interface ArchHealth {
  /** Overall health score (0-100) */
  score: number;
  /** Violations found */
  violations: ArchViolation[];
  /** Dependency graph (namespace -> dependencies) */
  dependencyGraph: Record<string, string[]>;
  /** Layer compliance (namespace -> layer) */
  layerCompliance: Record<string, {
    expected: string;
    actual: string;
    compliant: boolean;
  }>;
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
    structure: number;      // File/folder organization
    naming: number;         // Naming conventions
    dependencies: number;   // Dependency management
    documentation: number;  // README, JSDoc, comments
  };
}

// ============================================================================
// AI NAVIGATION
// ============================================================================

/**
 * Quick navigation hints for AI
 */
export interface AiNavigation {
  /** Where to add new code by type */
  addNewCode: {
    serverLogic: string;
    clientHook: string;
    utility: string;
    constant: string;
    integration: string;
    component: string;
    apiRoute: string;
    test: string;
  };
  /** Common file patterns */
  filePatterns: {
    pattern: string;
    meaning: string;
    example: string;
  }[];
  /** Import conventions */
  importConventions: {
    absoluteImports: boolean;
    alias: string | null;
    barrelExports: boolean;
    preferredOrder: string[];
  };
  /** Naming conventions */
  namingConventions: {
    files: string;          // kebab-case, camelCase, PascalCase
    components: string;
    hooks: string;
    utilities: string;
    constants: string;
    types: string;
  };
}

// ============================================================================
// FULL RESULT
// ============================================================================

/**
 * Full analysis result (enhanced)
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

  // ===== ENHANCED FIELDS =====

  /** Project context for AI */
  context?: ProjectContext;
  /** Architecture health analysis */
  archHealth?: ArchHealth;
  /** Standards compliance report */
  standards?: StandardsCompliance;
  /** AI navigation hints */
  aiNavigation?: AiNavigation;
}

// ============================================================================
// COMMAND OPTIONS
// ============================================================================

import type { OutputFormat } from '../../types';

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
  /** Output format (default: 'ai') */
  format?: OutputFormat;
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
