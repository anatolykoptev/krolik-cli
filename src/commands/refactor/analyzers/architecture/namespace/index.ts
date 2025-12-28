/**
 * @module commands/refactor/analyzers/architecture/namespace
 * @description Namespace structure analyzer for lib/ directory
 *
 * Analyzes project lib/ directory and suggests @namespace organization
 * following Clean Architecture principles:
 * - @core: Foundation layer (auth, config, utilities)
 * - @domain: Business logic (data access, state management)
 * - @integrations: External services (storage, APIs)
 * - @ui: UI utilities (hooks, providers)
 * - @seo: SEO (metadata, structured data)
 * - @utils: Shared utilities
 *
 * Consolidated from commands/refine/analyzer
 */

// Re-export namespace info from core constants
export { NAMESPACE_INFO } from '../../../core/constants';
// Re-export analysis functions
export { analyzeNamespaceDirectory, analyzeNamespaceStructure } from './analysis';
// Re-export file system utilities
export { countTsFiles, findLibDir, getSubdirs, isNamespaced } from './fs-utils';

// Re-export migration functions
export { generateNamespaceMigrationPlan } from './migration';
// Re-export scoring functions
export { calculateNamespaceScore, detectNamespaceCategory } from './scoring';
// Re-export types
export type {
  NamespaceAnalysisResult,
  NamespaceImportUpdate,
  NamespaceMigrationMove,
  NamespaceMigrationPlan,
} from './types';
