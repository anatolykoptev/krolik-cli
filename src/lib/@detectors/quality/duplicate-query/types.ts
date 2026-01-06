/**
 * @module lib/@detectors/quality/duplicate-query/types
 * @description Types for duplicate Prisma/tRPC query detection
 */

// ============================================================================
// OPERATION TYPES
// ============================================================================

/**
 * Prisma operation types
 */
export type PrismaOperation =
  | 'findMany'
  | 'findFirst'
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirstOrThrow'
  | 'create'
  | 'createMany'
  | 'update'
  | 'updateMany'
  | 'delete'
  | 'deleteMany'
  | 'upsert'
  | 'count'
  | 'aggregate'
  | 'groupBy';

/**
 * tRPC hook types
 */
export type TrpcHook = 'useQuery' | 'useMutation' | 'useInfiniteQuery' | 'useSuspenseQuery';

// ============================================================================
// QUERY INFO
// ============================================================================

/**
 * A single Prisma query detected in source code
 */
export interface PrismaQueryInfo {
  /** File where query is located */
  file: string;
  /** Line number of the query */
  line: number;
  /** Prisma model being queried (e.g., "user", "booking") */
  model: string;
  /** Operation type (findMany, findUnique, etc.) */
  operation: PrismaOperation;
  /** Normalized where clause structure */
  whereStructure: string;
  /** Normalized select/include structure */
  selectStructure: string;
  /** Structural fingerprint of the entire query */
  fingerprint: string;
  /** Raw query code snippet */
  snippet: string;
  /** tRPC procedure name (if within a procedure) */
  procedureName?: string;
  /** Router name (if within a router file) */
  routerName?: string;
}

/**
 * A single tRPC query hook detected in source code
 */
export interface TrpcQueryInfo {
  /** File where query is located */
  file: string;
  /** Line number */
  line: number;
  /** Full procedure path (e.g., "businessPlaces.list") */
  procedurePath: string;
  /** Router name (e.g., "businessPlaces") */
  router: string;
  /** Procedure name (e.g., "list") */
  procedure: string;
  /** Hook type (useQuery, useMutation, etc.) */
  hook: TrpcHook;
  /** Normalized input structure */
  inputStructure: string;
  /** Structural fingerprint */
  fingerprint: string;
  /** Raw code snippet */
  snippet: string;
  /** Component/hook name where it's used */
  componentName?: string;
}

// ============================================================================
// DUPLICATE GROUPS
// ============================================================================

/**
 * A group of duplicate Prisma queries
 */
export interface DuplicatePrismaQueryGroup {
  /** Shared fingerprint */
  fingerprint: string;
  /** Prisma model being queried */
  model: string;
  /** Operation type */
  operation: PrismaOperation;
  /** All locations where this query pattern appears */
  locations: PrismaQueryInfo[];
  /** Similarity score (0-1) for near-duplicates */
  similarity: number;
  /** Suggested refactoring */
  suggestion: RefactoringSuggestion;
}

/**
 * A group of duplicate tRPC queries
 */
export interface DuplicateTrpcQueryGroup {
  /** Shared fingerprint */
  fingerprint: string;
  /** Full procedure path */
  procedurePath: string;
  /** Hook type */
  hook: TrpcHook;
  /** All locations where this query is called */
  locations: TrpcQueryInfo[];
  /** Similarity score (0-1) */
  similarity: number;
  /** Suggested refactoring */
  suggestion: RefactoringSuggestion;
}

// ============================================================================
// REFACTORING SUGGESTIONS
// ============================================================================

/**
 * Suggested refactoring for duplicate queries
 */
export interface RefactoringSuggestion {
  /** Type of refactoring */
  type: 'extract-hook' | 'extract-function' | 'use-existing' | 'create-service';
  /** Suggested function/hook name */
  name: string;
  /** Suggested location for the extracted code */
  suggestedFile: string;
  /** Code template for the extracted code */
  codeTemplate?: string;
}

// ============================================================================
// DETECTION RESULT
// ============================================================================

/**
 * Detection result for a single query (used during AST traversal)
 */
export interface QueryDetection {
  /** Detection type */
  type: 'prisma' | 'trpc';
  /** SWC AST offset */
  offset: number;
  /** Detected query information (without file-specific fields) */
  data:
    | Omit<PrismaQueryInfo, 'file' | 'line' | 'snippet'>
    | Omit<TrpcQueryInfo, 'file' | 'line' | 'snippet'>;
}

/**
 * Context for query detection
 */
export interface QueryDetectorContext {
  /** Current function/component name */
  functionName?: string;
  /** Current router name (for tRPC routers) */
  routerName?: string;
  /** Current procedure name (for tRPC procedures) */
  procedureName?: string;
  /** Whether we're inside a tRPC router definition */
  inTrpcRouter?: boolean;
  /** Whether we're inside a React component */
  inReactComponent?: boolean;
}
