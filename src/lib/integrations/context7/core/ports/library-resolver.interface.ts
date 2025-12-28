/**
 * @module lib/integrations/context7/core/ports/library-resolver.interface
 * @description Interface for library ID resolution
 *
 * Defines the contract for resolving npm package names to Context7 library IDs.
 * Supports multiple resolution strategies with priority ordering.
 */

import type { ResolutionResult } from '../../types';

/**
 * Interface for library ID resolution.
 *
 * Implementations can use different strategies:
 * - Cache lookup
 * - Context7 API search
 * - Manual mappings
 * - GitHub API fallback
 *
 * @example
 * ```ts
 * class CacheResolver implements ILibraryResolver {
 *   readonly priority = 1;
 *
 *   async resolve(name: string): Promise<ResolutionResult | null> {
 *     return getCachedMapping(name);
 *   }
 * }
 * ```
 */
export interface ILibraryResolver {
  /**
   * Priority for this resolver (lower = higher priority).
   * Used when chaining multiple resolvers.
   */
  readonly priority: number;

  /**
   * Resolve a library name to its Context7 ID.
   *
   * @param npmName - npm package name (e.g., 'next', '@prisma/client')
   * @returns Resolution result with Context7 ID, or null if not resolved
   */
  resolve(npmName: string): Promise<ResolutionResult | null>;

  /**
   * Check if this resolver can handle the given library name.
   *
   * Optional method for fast-path rejection.
   *
   * @param npmName - npm package name
   * @returns True if this resolver might resolve the name
   */
  canResolve?(npmName: string): boolean;
}

/**
 * Chain of resolvers with priority ordering.
 *
 * Tries each resolver in priority order until one succeeds.
 */
export interface IResolverChain {
  /**
   * Resolve using all registered resolvers.
   *
   * @param npmName - npm package name
   * @returns Resolution result from first successful resolver
   */
  resolve(npmName: string): Promise<ResolutionResult | null>;

  /**
   * Add a resolver to the chain.
   *
   * @param resolver - Resolver to add
   */
  addResolver(resolver: ILibraryResolver): void;
}

/**
 * Topic provider interface.
 *
 * Returns recommended topics for a library.
 */
export interface ITopicProvider {
  /**
   * Get recommended topics for a library.
   *
   * Topics are ordered by relevance/usage.
   *
   * @param libraryId - Context7 library ID
   * @param limit - Maximum number of topics
   * @returns Array of topic strings
   */
  getTopics(libraryId: string, limit?: number): string[];

  /**
   * Record topic usage for learning.
   *
   * @param libraryId - Context7 library ID
   * @param topic - Topic that was used
   */
  recordUsage(libraryId: string, topic: string): void;
}
