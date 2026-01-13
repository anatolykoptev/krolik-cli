/**
 * @module commands/context/constants
 * @description Configuration constants for context command
 */

/** Maximum number of recent commits to include */
export const MAX_COMMITS = 5;

/** Maximum number of memory items to include */
export const MAX_MEMORIES = 10;

// ============================================================================
// DIRECTORY PATHS - Standard project structure patterns
// ============================================================================

/** Directories to scan for Zod schemas */
export const ZOD_DIRS = [
  'packages/shared/src/schemas',
  'packages/shared/src/validation',
  'packages/db/src/schemas',
  'packages/api/src/lib',
  'src/schemas',
  'src/lib/schemas',
] as const;

/** Directories to scan for React components */
export const COMPONENT_DIRS = ['apps/web/components', 'src/components'] as const;

/** Directories to scan for test files */
export const TEST_DIRS = [
  'packages/api/src/routers/__tests__',
  'apps/web/__tests__',
  '__tests__',
  'tests',
] as const;

/** Directories to scan for TypeScript types */
export const TYPE_DIRS = [
  'packages/shared/src/types',
  'packages/api/src/types',
  'apps/web/types',
  'src/types',
  'types',
] as const;

/** Directories to scan for import graph analysis */
export const IMPORT_DIRS = [
  'packages/api/src/routers',
  'apps/web/components',
  'src/commands',
] as const;

/** Directories for advanced import graph analysis */
export const IMPORT_GRAPH_DIRS = [
  'packages/api/src',
  'packages/shared/src',
  'apps/web/src',
  'apps/web/components',
  'src',
] as const;

/** Directories to scan for Prisma schema */
export const SCHEMA_DIRS = ['packages/db/prisma', 'prisma'] as const;

/** Directories to scan for tRPC routers */
export const ROUTER_DIRS = [
  'packages/api/src/routers',
  'packages/api/src/router',
  'src/server/routers',
  'src/routers',
] as const;

// ============================================================================
// DOMAIN FILTERING
// ============================================================================

/** Generic domains to filter out from type patterns */
export const GENERIC_DOMAINS = ['general', 'development', 'context', 'feature'] as const;
