/**
 * @module lib/@detectors/quality/duplicate-query/patterns
 * @description Constants and patterns for Prisma/tRPC query detection
 */

import type { PrismaOperation, TrpcHook } from './types';

// ============================================================================
// PRISMA PATTERNS
// ============================================================================

/**
 * Prisma client identifiers to look for in code
 */
export const PRISMA_CLIENT_IDENTIFIERS = ['ctx.db', 'ctx.prisma', 'prisma', 'db'] as const;

/**
 * Prisma operations that read data (candidates for deduplication)
 */
export const PRISMA_READ_OPERATIONS: PrismaOperation[] = [
  'findMany',
  'findFirst',
  'findUnique',
  'findUniqueOrThrow',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
];

/**
 * Prisma operations that write data
 */
export const PRISMA_WRITE_OPERATIONS: PrismaOperation[] = [
  'create',
  'createMany',
  'update',
  'updateMany',
  'delete',
  'deleteMany',
  'upsert',
];

/**
 * All Prisma operations
 */
export const ALL_PRISMA_OPERATIONS: PrismaOperation[] = [
  ...PRISMA_READ_OPERATIONS,
  ...PRISMA_WRITE_OPERATIONS,
];

// ============================================================================
// TRPC PATTERNS
// ============================================================================

/**
 * tRPC client identifiers
 */
export const TRPC_CLIENT_IDENTIFIERS = ['trpc', 'api', 'client'] as const;

/**
 * tRPC query hooks
 */
export const TRPC_QUERY_HOOKS: TrpcHook[] = ['useQuery', 'useSuspenseQuery', 'useInfiniteQuery'];

/**
 * tRPC mutation hooks
 */
export const TRPC_MUTATION_HOOKS: TrpcHook[] = ['useMutation'];

/**
 * All tRPC hooks
 */
export const ALL_TRPC_HOOKS: TrpcHook[] = [...TRPC_QUERY_HOOKS, ...TRPC_MUTATION_HOOKS];

// ============================================================================
// DETECTION THRESHOLDS
// ============================================================================

/**
 * Minimum occurrences to consider a duplicate
 */
export const MIN_DUPLICATE_OCCURRENCES = 2;

/**
 * Minimum similarity for near-duplicate detection (0-1)
 */
export const SIMILARITY_THRESHOLD = 0.85;

/**
 * Maximum queries to analyze before stopping (performance limit)
 */
export const MAX_QUERIES_TO_ANALYZE = 1000;

// ============================================================================
// SKIP PATTERNS
// ============================================================================

/**
 * File patterns to skip for duplicate query detection
 */
export const SKIP_FILE_PATTERNS = [
  '**/migrations/**',
  '**/seed.ts',
  '**/seed/**',
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/test/**',
  '**/tests/**',
  '**/__tests__/**',
  '**/lib/queries/**', // Don't flag files that ARE the extracted queries
  '**/services/**', // Service layers are expected to have queries
] as const;

/**
 * Router file patterns (where Prisma queries are expected)
 */
export const ROUTER_FILE_PATTERNS = [
  '**/routers/**/*.ts',
  '**/server/api/**/*.ts',
  '**/trpc/**/*.ts',
] as const;

/**
 * Component file patterns (where tRPC hooks are used)
 */
export const COMPONENT_FILE_PATTERNS = [
  '**/components/**/*.tsx',
  '**/features/**/*.tsx',
  '**/app/**/*.tsx',
  '**/pages/**/*.tsx',
  '**/*.tsx',
] as const;

// ============================================================================
// NAMING SUGGESTIONS
// ============================================================================

/**
 * Suggested hook names for common query patterns
 */
export const HOOK_NAME_SUGGESTIONS: Record<string, string> = {
  findMany: 'useList',
  findFirst: 'useFirst',
  findUnique: 'useById',
  count: 'useCount',
  aggregate: 'useStats',
};

/**
 * Suggested file locations for extracted queries
 */
export const SUGGESTED_FILE_LOCATIONS = {
  prismaQueries: 'packages/api/src/lib/queries',
  trpcHooks: 'apps/web/lib/@ui/hooks',
} as const;
