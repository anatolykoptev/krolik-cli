/**
 * @module lib/@detectors/quality/duplicate-query
 * @description SWC AST detector for duplicate Prisma/tRPC queries
 *
 * Detects duplicate database/API queries that could be consolidated:
 * - Duplicate Prisma findMany/findUnique/etc. calls with similar structures
 * - Duplicate tRPC useQuery hooks calling the same procedure
 * - Similar query patterns that could be extracted to shared hooks/functions
 *
 * Used by:
 * - audit command with --mode=queries
 * - fix command for query consolidation suggestions
 */

// ============================================================================
// DETECTOR
// ============================================================================

export {
  detectQuery,
  detectReactComponentContext,
  detectTrpcRouterContext,
} from './detector';

// ============================================================================
// NORMALIZER
// ============================================================================

export {
  calculateQuerySimilarity,
  generatePrismaFingerprint,
  generateTrpcFingerprint,
  type NormalizedQuery,
  type NormalizedTrpcInput,
  normalizeQueryStructure,
  normalizeTrpcInput,
} from './normalizer';

// ============================================================================
// PATTERNS
// ============================================================================

export {
  ALL_PRISMA_OPERATIONS,
  ALL_TRPC_HOOKS,
  COMPONENT_FILE_PATTERNS,
  HOOK_NAME_SUGGESTIONS,
  MAX_QUERIES_TO_ANALYZE,
  MIN_DUPLICATE_OCCURRENCES,
  PRISMA_CLIENT_IDENTIFIERS,
  PRISMA_READ_OPERATIONS,
  PRISMA_WRITE_OPERATIONS,
  ROUTER_FILE_PATTERNS,
  SIMILARITY_THRESHOLD,
  SKIP_FILE_PATTERNS,
  SUGGESTED_FILE_LOCATIONS,
  TRPC_CLIENT_IDENTIFIERS,
  TRPC_MUTATION_HOOKS,
  TRPC_QUERY_HOOKS,
} from './patterns';

// ============================================================================
// TYPES
// ============================================================================

export type {
  DuplicatePrismaQueryGroup,
  DuplicateTrpcQueryGroup,
  PrismaOperation,
  PrismaQueryInfo,
  QueryDetection,
  QueryDetectorContext,
  RefactoringSuggestion,
  TrpcHook,
  TrpcQueryInfo,
} from './types';
