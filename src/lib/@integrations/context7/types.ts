/**
 * @module lib/@integrations/context7/types
 * @description Type definitions for the Context7 integration module
 *
 * This module provides types for:
 * - Cached library metadata (re-exported from @storage/docs)
 * - Documentation sections and search results (re-exported from @storage/docs)
 * - Fetch and search options
 * - Library detection and resolution
 * - Registry mappings and topics
 * - Port interfaces for dependency inversion (merged from core/ports)
 */

// Re-export shared types from @storage/docs (canonical source)
export type {
  CachedLibrary,
  DocSearchResult,
  DocSection,
  DocsCacheStats,
  DocsSearchOptions,
} from '../../@storage/docs/types';

// Re-export types from client for use in interfaces
import type { CodeDocsResponse, GetDocsOptions, InfoDocsResponse, SearchResult } from './client';

// ============================================================================
// Port Interfaces - Dependency Inversion (merged from core/ports)
// ============================================================================

/**
 * Response from documentation fetch.
 */
export type DocsResponse = CodeDocsResponse | InfoDocsResponse;

/**
 * Repository interface for library documentation storage.
 *
 * Abstracts storage operations to enable:
 * - Dependency injection and testing
 * - Multiple storage implementations
 * - Clear separation between domain and infrastructure
 *
 * @example
 * ```ts
 * class SqliteLibraryRepository implements ILibraryRepository {
 *   getLibrary(id: string): CachedLibrary | null {
 *     // SQLite implementation
 *   }
 * }
 * ```
 */
export interface ILibraryRepository {
  /**
   * Get a cached library by its Context7 ID.
   *
   * @param libraryId - Context7 library ID (e.g., '/vercel/next.js')
   * @returns Cached library with metadata, or null if not found
   */
  getLibrary(libraryId: string): import('../../@storage/docs/types').CachedLibrary | null;

  /**
   * Get a cached library by its display name.
   *
   * @param name - Library display name (e.g., 'next.js')
   * @returns Cached library with metadata, or null if not found
   */
  getLibraryByName(name: string): import('../../@storage/docs/types').CachedLibrary | null;

  /**
   * Save or update a library entry in the cache.
   *
   * Creates a new entry if the library doesn't exist,
   * or updates the existing entry with a new expiration time.
   *
   * @param libraryId - Context7 library ID
   * @param name - Display name
   * @param version - Optional version string
   * @returns The saved library entry
   */
  saveLibrary(
    libraryId: string,
    name: string,
    version?: string,
  ): import('../../@storage/docs/types').CachedLibrary;

  /**
   * Save a documentation section for a library.
   *
   * Sections can be from different topics and pages.
   * Duplicate sections (same library, title, page) are updated.
   *
   * @param libraryId - Context7 library ID
   * @param topic - Optional topic category
   * @param title - Section title
   * @param content - Section content (markdown)
   * @param codeSnippets - Extracted code snippets
   * @param pageNumber - Page number from API pagination
   * @returns The saved section
   */
  saveSection(
    libraryId: string,
    topic: string | undefined,
    title: string,
    content: string,
    codeSnippets: string[],
    pageNumber: number,
  ): import('../../@storage/docs/types').DocSection;

  /**
   * Search cached documentation using full-text search.
   *
   * Uses FTS5 for efficient searching with fallback to LIKE.
   *
   * @param options - Search options including query and filters
   * @returns Array of search results with relevance scores
   */
  searchDocs(
    options: import('../../@storage/docs/types').DocsSearchOptions,
  ): import('../../@storage/docs/types').DocSearchResult[];

  /**
   * Get all cached libraries.
   *
   * @returns Array of all cached libraries with their metadata
   */
  listLibraries(): import('../../@storage/docs/types').CachedLibrary[];

  /**
   * Delete a library and all its sections from the cache.
   *
   * @param libraryId - Context7 library ID to delete
   * @returns True if library was deleted, false if not found
   */
  deleteLibrary(libraryId: string): boolean;

  /**
   * Clear expired library caches.
   *
   * @returns Number of libraries cleared
   */
  clearExpired(): number;
}

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

/**
 * Interface for fetching library documentation.
 *
 * Abstracts external API calls for:
 * - Testing with mocks
 * - Resilience patterns (retry, circuit breaker)
 * - Rate limiting
 * - Caching at the HTTP level
 *
 * @example
 * ```ts
 * class Context7Fetcher implements IDocumentFetcher {
 *   async getDocs(libraryId: string, options?: GetDocsOptions) {
 *     return this.client.getDocs(libraryId, options);
 *   }
 * }
 * ```
 */
export interface IDocumentFetcher {
  /**
   * Check if the fetcher is available (API key configured, etc.).
   *
   * @returns True if fetcher can be used
   */
  isAvailable(): boolean;

  /**
   * Fetch documentation for a library.
   *
   * @param libraryId - Context7 library ID (e.g., '/vercel/next.js')
   * @param options - Fetch options (mode, page, topic, limit)
   * @returns Documentation response with snippets and pagination
   */
  getDocs(libraryId: string, options?: GetDocsOptions): Promise<DocsResponse>;

  /**
   * Search for libraries by name.
   *
   * @param query - Search query
   * @returns Array of matching libraries
   */
  searchLibrary(query: string): Promise<SearchResult[]>;
}

/**
 * Configuration for resilient fetcher.
 */
export interface ResilientFetcherConfig {
  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;

  /**
   * Maximum retry attempts.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Delay between retries in milliseconds.
   * @default 1000
   */
  retryDelay?: number;

  /**
   * Rate limit: requests per minute.
   * @default 60
   */
  rateLimit?: number;
}

/**
 * Resilient document fetcher with retry and rate limiting.
 */
export interface IResilientFetcher extends IDocumentFetcher {
  /**
   * Current circuit breaker state.
   */
  readonly circuitState: 'closed' | 'open' | 'half-open';

  /**
   * Reset the circuit breaker.
   */
  resetCircuit(): void;
}

/**
 * Options for fetching and caching library documentation.
 *
 * Controls how documentation is retrieved from Context7 and
 * stored in the local cache.
 *
 * @example
 * ```ts
 * const options: DocsFetchOptions = {
 *   library: "next.js",
 *   topic: "routing",
 *   mode: "code",
 *   force: false,
 *   maxPages: 5
 * }
 * ```
 */
export interface DocsFetchOptions {
  /** Library name to fetch (will be resolved to Context7 ID) */
  library: string;

  /** Optional specific topic to focus documentation on */
  topic?: string | undefined;

  /** Documentation mode: 'code' for API reference, 'info' for conceptual guides */
  mode?: 'code' | 'info' | undefined;

  /** Force refresh even if valid cache exists */
  force?: boolean | undefined;

  /** Maximum number of pages to fetch (defaults to 10) */
  maxPages?: number | undefined;
}

/**
 * Detected library from package.json analysis.
 *
 * Represents a dependency found in package.json with its cache status.
 * Used by the auto-detection system to suggest libraries for caching.
 *
 * @example
 * ```ts
 * const detected: DetectedLibrary = {
 *   name: "next",
 *   version: "14.3.0",
 *   isCached: true,
 *   isExpired: false,
 *   context7Id: "/vercel/next.js"
 * }
 * ```
 */
export interface DetectedLibrary {
  /** NPM package name */
  name: string;

  /** Version from package.json */
  version: string;

  /** Whether this library is already cached locally */
  isCached: boolean;

  /** Whether the cached version (if any) has expired */
  isExpired: boolean;

  /** Resolved Context7 library ID, if available */
  context7Id?: string | undefined;
}

// ============================================================================
// Registry Types - Dynamic Library Resolution
// ============================================================================

/**
 * Source of library resolution.
 * Indicates where the Context7 ID was obtained from.
 */
export type ResolutionSource = 'cache' | 'api' | 'default';

/**
 * Result of library ID resolution.
 *
 * Contains the resolved Context7 ID along with metadata about
 * how the resolution was performed.
 *
 * @example
 * ```ts
 * const result: ResolutionResult = {
 *   context7Id: '/vercel/next.js',
 *   displayName: 'Next.js',
 *   source: 'cache',
 *   confidence: 1.0
 * }
 * ```
 */
export interface ResolutionResult {
  /** Resolved Context7 library ID (e.g., '/vercel/next.js') */
  context7Id: string;

  /** Human-readable library name */
  displayName: string;

  /** How the resolution was obtained */
  source: ResolutionSource;

  /** Confidence score from 0.0 to 1.0 */
  confidence: number;
}

/**
 * Library mapping stored in the registry database.
 *
 * Maps npm package names to Context7 library IDs with metadata.
 *
 * @example
 * ```ts
 * const mapping: LibraryMapping = {
 *   id: 1,
 *   npmName: 'next',
 *   context7Id: '/vercel/next.js',
 *   displayName: 'Next.js',
 *   stars: 125000,
 *   benchmarkScore: 85,
 *   resolvedAt: '2025-12-24T10:00:00Z',
 *   isManual: false
 * }
 * ```
 */
export interface LibraryMapping {
  /** Database primary key */
  id: number;

  /** NPM package name (normalized to lowercase) */
  npmName: string;

  /** Resolved Context7 library ID */
  context7Id: string;

  /** Human-readable library name */
  displayName: string;

  /** GitHub stars count (if available) */
  stars: number;

  /** Context7 benchmark score (0-100) */
  benchmarkScore: number;

  /** ISO timestamp when mapping was resolved */
  resolvedAt: string;

  /** Whether this mapping was manually registered */
  isManual: boolean;
}

/**
 * Topic associated with a library.
 *
 * Topics are learned from usage patterns to improve
 * documentation fetching relevance.
 *
 * @example
 * ```ts
 * const topic: LibraryTopic = {
 *   id: 1,
 *   context7Id: '/vercel/next.js',
 *   topic: 'app-router',
 *   usageCount: 15,
 *   lastUsedAt: '2025-12-24T10:00:00Z',
 *   isDefault: true
 * }
 * ```
 */
export interface LibraryTopic {
  /** Database primary key */
  id: number;

  /** Context7 library ID this topic belongs to */
  context7Id: string;

  /** Topic name (e.g., 'routing', 'hooks') */
  topic: string;

  /** Number of times this topic has been used */
  usageCount: number;

  /** ISO timestamp of last usage */
  lastUsedAt: string;

  /** Whether this is a default (seeded) topic */
  isDefault: boolean;
}

/**
 * Registry statistics.
 *
 * Provides overview of the library registry state.
 */
export interface RegistryStats {
  /** Total number of npm->Context7 mappings */
  totalMappings: number;

  /** Number of unique Context7 library IDs */
  uniqueLibraries: number;

  /** Total number of topics across all libraries */
  totalTopics: number;

  /** Number of manually registered mappings */
  manualMappings: number;
}
