/**
 * @module commands/refactor/core
 * @description Core infrastructure for refactor command
 *
 * MINIMAL BARREL - Only the most common exports.
 * For specific types, import directly from:
 * - ./types        - Base types (DuplicateInfo, StructureAnalysis, etc.)
 * - ./types-ai     - AI-enhanced types (ProjectContext, ArchHealth, etc.)
 * - ./options      - Command options (RefactorOptions, etc.)
 * - ./constants    - Constants (NAMESPACE_INFO, etc.)
 * - ./file-cache   - File caching utilities
 * - ./types-migration - Type migration types
 */

// ============================================================================
// MOST COMMON TYPES (10-15 max)
// ============================================================================

// Constants - frequently needed for category detection
export { detectCategory, NAMESPACE_INFO } from './constants';
// Options - always needed
export type { RefactorOptions } from './options';
export { getModeFlags, resolveMode } from './options';
// Base types - most frequently used
export type {
  DuplicateInfo,
  MigrationPlan,
  NamespaceCategory,
  RefactorAnalysis,
  StructureAnalysis,
} from './types';
// AI types - most frequently used
export type {
  ArchHealth,
  EnhancedRefactorAnalysis,
  ProjectContext,
  Recommendation,
} from './types-ai';
