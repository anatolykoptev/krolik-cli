/**
 * @module lib/@detectors/quality/duplicate-query/normalizer
 * @description Normalizes Prisma/tRPC queries for structural comparison
 *
 * Normalizes:
 * - Where clause keys (ignores literal values)
 * - Select/include field names
 * - Nested relation queries
 * - Input argument structures
 */

import { createHash } from 'node:crypto';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Normalized query structure
 */
export interface NormalizedQuery {
  /** Normalized where clause (keys only) */
  where: string[];
  /** Normalized select fields */
  select: string[];
  /** Normalized include relations */
  include: string[];
  /** Normalized orderBy fields */
  orderBy: string[];
  /** Has pagination (take/skip) */
  hasPagination: boolean;
}

/**
 * Normalized tRPC input
 */
export interface NormalizedTrpcInput {
  /** Keys of the input object */
  keys: string[];
  /** Whether input is undefined/empty */
  isEmpty: boolean;
  /** Structure signature */
  signature: string;
}

// ============================================================================
// PRISMA QUERY NORMALIZATION
// ============================================================================

/**
 * Normalize a Prisma query structure for comparison
 * Extracts the "skeleton" of the query, ignoring actual values
 *
 * @param queryArgs - The query arguments object from AST
 * @returns Normalized query structure
 *
 * @example
 * ```ts
 * // Input: { where: { userId: "123", status: "active" }, include: { user: true } }
 * // Output: { where: ["userId", "status"], select: [], include: ["user"], orderBy: [], hasPagination: false }
 * ```
 */
export function normalizeQueryStructure(queryArgs: unknown): NormalizedQuery {
  const normalized: NormalizedQuery = {
    where: [],
    select: [],
    include: [],
    orderBy: [],
    hasPagination: false,
  };

  if (!queryArgs || typeof queryArgs !== 'object') {
    return normalized;
  }

  const args = queryArgs as Record<string, unknown>;

  // Extract where clause keys
  if (args.where && typeof args.where === 'object') {
    normalized.where = extractObjectKeys(args.where).sort();
  }

  // Extract select fields
  if (args.select && typeof args.select === 'object') {
    normalized.select = extractObjectKeys(args.select).sort();
  }

  // Extract include relations
  if (args.include && typeof args.include === 'object') {
    normalized.include = extractObjectKeys(args.include).sort();
  }

  // Extract orderBy fields
  if (args.orderBy) {
    normalized.orderBy = extractOrderByKeys(args.orderBy).sort();
  }

  // Check for pagination
  normalized.hasPagination = 'take' in args || 'skip' in args;

  return normalized;
}

/**
 * Extract keys from a nested object structure
 */
function extractObjectKeys(obj: unknown, prefix = ''): string[] {
  const keys: string[] = [];

  if (!obj || typeof obj !== 'object') {
    return keys;
  }

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    // Add the key
    keys.push(fullKey);

    // Recursively extract nested keys for certain patterns
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // For nested where conditions (AND, OR, NOT)
      if (['AND', 'OR', 'NOT'].includes(key)) {
        keys.push(...extractObjectKeys(value, fullKey));
      }
      // For nested relations in where
      else if (typeof value === 'object') {
        const nestedKeys = extractObjectKeys(value, fullKey);
        // Only add if there are meaningful nested keys
        if (nestedKeys.length > 0) {
          keys.push(...nestedKeys);
        }
      }
    }
  }

  return keys;
}

/**
 * Extract orderBy field names
 */
function extractOrderByKeys(orderBy: unknown): string[] {
  if (!orderBy) return [];

  if (Array.isArray(orderBy)) {
    return orderBy.flatMap((item) => extractOrderByKeys(item));
  }

  if (typeof orderBy === 'object') {
    return Object.keys(orderBy as Record<string, unknown>);
  }

  return [];
}

// ============================================================================
// TRPC INPUT NORMALIZATION
// ============================================================================

/**
 * Normalize tRPC hook input for comparison
 *
 * @param input - The input argument from AST
 * @returns Normalized input structure
 */
export function normalizeTrpcInput(input: unknown): NormalizedTrpcInput {
  if (input === undefined || input === null) {
    return { keys: [], isEmpty: true, signature: 'empty' };
  }

  if (typeof input !== 'object') {
    return { keys: [], isEmpty: false, signature: 'primitive' };
  }

  const keys = extractObjectKeys(input).sort();
  const signature = keys.join(',') || 'object';

  return {
    keys,
    isEmpty: keys.length === 0,
    signature,
  };
}

// ============================================================================
// FINGERPRINT GENERATION
// ============================================================================

/**
 * Generate a fingerprint for a Prisma query
 *
 * @param model - Prisma model name
 * @param operation - Prisma operation
 * @param normalized - Normalized query structure
 * @returns MD5 hash fingerprint
 */
export function generatePrismaFingerprint(
  model: string,
  operation: string,
  normalized: NormalizedQuery,
): string {
  const data = JSON.stringify({
    model: model.toLowerCase(),
    operation,
    where: normalized.where,
    select: normalized.select,
    include: normalized.include,
    orderBy: normalized.orderBy,
    hasPagination: normalized.hasPagination,
  });

  return createHash('md5').update(data).digest('hex').slice(0, 12);
}

/**
 * Generate a fingerprint for a tRPC query hook
 *
 * @param procedurePath - Full procedure path (e.g., "users.getById")
 * @param hook - Hook type (useQuery, useMutation, etc.)
 * @param inputNormalized - Normalized input structure
 * @returns MD5 hash fingerprint
 */
export function generateTrpcFingerprint(
  procedurePath: string,
  hook: string,
  inputNormalized: NormalizedTrpcInput,
): string {
  const data = JSON.stringify({
    procedurePath: procedurePath.toLowerCase(),
    hook,
    inputSignature: inputNormalized.signature,
  });

  return createHash('md5').update(data).digest('hex').slice(0, 12);
}

// ============================================================================
// SIMILARITY CALCULATION
// ============================================================================

/**
 * Calculate similarity between two normalized queries
 *
 * @param a - First normalized query
 * @param b - Second normalized query
 * @returns Similarity score (0-1)
 */
export function calculateQuerySimilarity(a: NormalizedQuery, b: NormalizedQuery): number {
  const whereScore = calculateArraySimilarity(a.where, b.where);
  const selectScore = calculateArraySimilarity(a.select, b.select);
  const includeScore = calculateArraySimilarity(a.include, b.include);
  const orderByScore = calculateArraySimilarity(a.orderBy, b.orderBy);
  const paginationScore = a.hasPagination === b.hasPagination ? 1 : 0.8;

  // Weighted average (where and include are most important)
  return (
    whereScore * 0.4 +
    includeScore * 0.3 +
    selectScore * 0.15 +
    orderByScore * 0.1 +
    paginationScore * 0.05
  );
}

/**
 * Calculate Jaccard similarity between two arrays
 */
function calculateArraySimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a);
  const setB = new Set(b);

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}
