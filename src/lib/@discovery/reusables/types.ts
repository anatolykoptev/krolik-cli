/**
 * @module lib/@modules/types
 * @description Type definitions for universal reusable code detection system
 *
 * This module provides types for detecting, classifying, and scoring
 * reusable modules across any TypeScript/JavaScript codebase.
 */

import type { ExportedMember } from '@/lib/@ast';

// ============================================================================
// CORE ENUMS
// ============================================================================

/**
 * Category of a reusable module
 *
 * Used to classify modules by their purpose and usage pattern.
 */
export type ModuleCategory =
  | 'ui-component' // React/Vue/Svelte components
  | 'hook' // React hooks (useXxx)
  | 'utility' // Pure functions, helpers
  | 'type' // TypeScript types/interfaces only
  | 'schema' // Zod, Yup, validation schemas
  | 'service' // API clients, data services
  | 'constant' // Configuration, constants
  | 'context' // React contexts, providers
  | 'hoc' // Higher-order components
  | 'model' // Data models, entities
  | 'unknown'; // Unclassified

/**
 * Reusability level based on scoring
 */
export type ReusabilityLevel =
  | 'core' // Essential shared utilities (80+ points)
  | 'high' // Frequently reused (50-79 points)
  | 'medium' // Occasionally reused (30-49 points)
  | 'low' // Potentially reusable (10-29 points)
  | 'none'; // Not reusable (<10 points)

// ============================================================================
// SIGNAL TYPES
// ============================================================================

/**
 * Signals from directory pattern matching
 */
export interface DirectorySignals {
  /** Matched directory pattern (e.g., 'lib/**', 'utils/**') */
  matchedPattern?: string;
  /** Directory depth from project root */
  depth: number;
  /** Score from directory analysis */
  score: number;
  /** Whether in a commonly recognized reusable directory */
  isInReusableDir: boolean;
}

/**
 * Signals from export pattern analysis
 */
export interface ExportSignals {
  /** Number of named exports */
  namedExportCount: number;
  /** Whether only has default export */
  defaultExportOnly: boolean;
  /** Whether has index.ts barrel file */
  hasBarrelFile: boolean;
  /** Count by export type */
  exportedFunctions: number;
  exportedTypes: number;
  exportedClasses: number;
  exportedConstants: number;
  exportedEnums: number;
  /** Score from export analysis */
  score: number;
}

/**
 * Signals from import frequency analysis
 */
export interface ImportSignals {
  /** Number of files that import this module */
  importedByCount: number;
  /** Number of different directories that import this */
  importedByDifferentDirs: number;
  /** Whether imported across package boundaries */
  isImportedAcrossPackages: boolean;
  /** List of importing file paths */
  importers: string[];
  /** Score from import analysis */
  score: number;
}

/**
 * Signals from naming convention analysis
 */
export interface NamingSignals {
  /** Matched naming pattern (e.g., 'hook', 'utility') */
  matchedPattern?: string;
  /** Whether name follows React hook convention */
  isHookNaming: boolean;
  /** Whether name follows utility function convention */
  isUtilityNaming: boolean;
  /** Whether name follows component convention (PascalCase) */
  isComponentNaming: boolean;
  /** Whether name follows constant convention (UPPER_CASE) */
  isConstantNaming: boolean;
  /** Whether name follows service convention */
  isServiceNaming: boolean;
  /** Score from naming analysis */
  score: number;
}

/**
 * Signals from JSDoc/documentation analysis
 */
export interface DocumentationSignals {
  /** Has @module JSDoc tag */
  hasModuleDoc: boolean;
  /** Has @example blocks */
  hasExamples: boolean;
  /** Has @public or @api tags */
  hasPublicApi: boolean;
  /** Mentions "reusable", "shared", "utility" */
  mentionsReusable: boolean;
  /** Has @see references */
  hasSeeAlso: boolean;
  /** Has any JSDoc comments */
  hasAnyDocs: boolean;
  /** Score from documentation analysis */
  score: number;
}

/**
 * Signals from content analysis (AST-based)
 */
export interface ContentSignals {
  /** Exports JSX elements */
  exportsJSX: boolean;
  /** Uses React hooks internally */
  usesReactHooks: boolean;
  /** Exports Zod/Yup schemas */
  exportsValidationSchema: boolean;
  /** Creates React context */
  createsReactContext: boolean;
  /** Is a pure function (no side effects) */
  isPureFunction: boolean;
  /** Has async operations */
  hasAsyncOperations: boolean;
  /** Score from content analysis */
  score: number;
}

/**
 * All detection signals combined
 */
export interface DetectionSignals {
  directory: DirectorySignals;
  exports: ExportSignals;
  imports: ImportSignals;
  naming: NamingSignals;
  documentation: DocumentationSignals;
  content: ContentSignals;
}

// ============================================================================
// MODULE TYPES
// ============================================================================

/**
 * A discovered reusable module
 */
export interface DiscoveredModule {
  // === Identity ===

  /** Relative path from project root */
  path: string;
  /** Absolute path */
  absolutePath: string;
  /** Module name (folder name for directories, file name for files) */
  name: string;
  /** Whether this is a directory module (has index.ts) or single file */
  isDirectory: boolean;

  // === Classification ===

  /** Detected category */
  category: ModuleCategory;
  /** Reusability level */
  reusabilityLevel: ReusabilityLevel;
  /** Numeric reusability score (0-100+) */
  reusabilityScore: number;

  // === Exports ===

  /** Exported members */
  exports: ExportedMember[];
  /** Total export count */
  exportCount: number;
  /** Description from JSDoc @description */
  description?: string;

  // === Usage Stats ===

  /** Paths of files that import this module */
  importedBy: string[];
  /** Count of importing files */
  importedByCount: number;

  // === Detection Info ===

  /** Signals that led to this detection */
  signals: DetectionSignals;
}

/**
 * Summary of discovered modules by category
 */
export type ModulesByCategory = Record<ModuleCategory, DiscoveredModule[]>;

/**
 * Summary of discovered modules by reusability level
 */
export type ModulesByReusability = Record<ReusabilityLevel, DiscoveredModule[]>;

/**
 * Result of module discovery
 */
export interface DiscoveryResult {
  /** All discovered modules */
  modules: DiscoveredModule[];

  /** Modules grouped by category */
  byCategory: ModulesByCategory;

  /** Modules grouped by reusability level */
  byReusability: ModulesByReusability;

  /** Statistics */
  stats: {
    totalModules: number;
    totalExports: number;
    scanDurationMs: number;
    filesScanned: number;
  };

  /** Project info */
  project: {
    root: string;
    name: string;
    type: 'app' | 'library' | 'monorepo';
  };
}

// ============================================================================
// CONFIGURATION TYPES
// ============================================================================

/**
 * Configuration for reusable module detection
 *
 * All fields are optional - system works with zero configuration.
 */
export interface ReusableDetectionConfig {
  // === Include/Exclude Patterns ===

  /** Additional glob patterns to scan for reusable code */
  include?: string[];
  /** Glob patterns to exclude from scanning */
  exclude?: string[];

  // === Force Overrides ===

  /** Glob patterns to always mark as reusable */
  forceReusable?: string[];
  /** Glob patterns to never mark as reusable */
  forceNotReusable?: string[];

  // === Scoring Adjustments ===

  /** Custom scores for directory patterns */
  directoryScores?: Record<string, number>;
  /** Minimum import count to consider reusable (default: 2) */
  minImportCount?: number;
  /** Minimum reusability score to include in results (default: 10) */
  minScore?: number;

  // === Category Overrides ===

  /** Force specific paths to specific categories */
  categoryOverrides?: Record<string, ModuleCategory>;

  // === Output Preferences ===

  /** Minimum reusability level to include in output */
  minReusabilityLevel?: ReusabilityLevel;
  /** Include modules with zero imports */
  includeUnused?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<
  Omit<ReusableDetectionConfig, 'directoryScores' | 'categoryOverrides'>
> & {
  directoryScores: Record<string, number>;
  categoryOverrides: Record<string, ModuleCategory>;
} = {
  include: [],
  exclude: [
    '**/__tests__/**',
    '**/__mocks__/**',
    '**/*.test.*',
    '**/*.spec.*',
    '**/*.stories.*',
    '**/stories/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
  ],
  forceReusable: [],
  forceNotReusable: [],
  directoryScores: {},
  minImportCount: 2,
  minScore: 10,
  categoryOverrides: {},
  minReusabilityLevel: 'low',
  includeUnused: false,
};

// ============================================================================
// PATTERN CONSTANTS
// ============================================================================

/**
 * Default directory patterns that indicate reusable code
 *
 * Format: pattern -> base score
 */
export const REUSABLE_DIRECTORY_PATTERNS: Record<string, number> = {
  // Core reusable directories (highest scores)
  'lib/**': 30,
  'libs/**': 30,
  'shared/**': 30,
  'common/**': 30,
  'core/**': 25,

  // Utility directories
  'utils/**': 25,
  'utilities/**': 25,
  'helpers/**': 25,

  // UI patterns
  'components/**': 20,
  'ui/**': 25,
  'primitives/**': 25,
  'atoms/**': 20,
  'molecules/**': 20,
  'organisms/**': 20,

  // React-specific
  'hooks/**': 25,
  'contexts/**': 20,
  'providers/**': 20,
  'hocs/**': 20,

  // Type/Schema patterns
  'types/**': 20,
  'interfaces/**': 20,
  'schemas/**': 25,
  'models/**': 20,
  'contracts/**': 25,
  'dtos/**': 20,

  // Service patterns
  'services/**': 25,
  'api/**': 20,
  'clients/**': 20,
  'integrations/**': 20,

  // Config patterns
  'config/**': 15,
  'constants/**': 20,
  'settings/**': 15,

  // Monorepo patterns (higher due to explicit sharing intent)
  'packages/shared/**': 35,
  'packages/common/**': 35,
  'packages/ui/**': 30,
  'packages/utils/**': 30,
  'packages/lib/**': 30,
  'packages/core/**': 30,
};

/**
 * Naming patterns for classification
 */
export const NAMING_PATTERNS = {
  /** React hook pattern: useAuth, useState, useCallback */
  hook: /^use[A-Z][a-zA-Z0-9]*$/,

  /** Utility function patterns */
  utility:
    /^(get|set|create|build|parse|format|validate|convert|transform|calculate|compute|extract|generate|make|find|filter|map|reduce|merge|clone|deep|shallow|is|has|can|should|will)[A-Z]/,

  /** Guard/predicate patterns */
  guard: /^(is|has|can|should|will|assert)[A-Z]/,

  /** Constant patterns: UPPER_SNAKE_CASE */
  constant: /^[A-Z][A-Z0-9_]+$/,

  /** Type patterns: IUser, TConfig, UserProps, AuthConfig */
  type: /^(I[A-Z]|T[A-Z])|((Props|Config|Options|Params|Args|Context|State|Data|Result|Response|Request|Payload)$)/,

  /** Schema patterns: userSchema, UserValidator, CreateUserDto */
  schema: /(Schema|Validator|Dto|Zod|Yup)$/i,

  /** Service patterns: AuthService, ApiClient, UserRepository */
  service: /(Service|Client|Api|Repository|Store|Manager|Handler|Controller)$/,

  /** Component patterns: PascalCase (but not hooks) */
  component: /^[A-Z][a-z][a-zA-Z0-9]*$/,

  /** Context patterns: AuthContext, ThemeProvider */
  context: /(Context|Provider)$/,

  /** HOC patterns: withAuth, withTheme */
  hoc: /^with[A-Z]/,
};

/**
 * Keywords in documentation that suggest reusability
 */
export const REUSABILITY_KEYWORDS = [
  'reusable',
  'shared',
  'utility',
  'helper',
  'common',
  'generic',
  'universal',
  'public api',
  '@public',
  '@api',
  'use this',
  'import from',
];
