/**
 * @module lib/integrations/context7/types
 * @description Type definitions for the Context7 integration module
 *
 * This module provides types for:
 * - Cached library metadata
 * - Documentation sections and search results
 * - Fetch and search options
 * - Library detection and resolution
 * - Registry mappings and topics
 */

/**
 * Cached library metadata stored in the local database.
 *
 * Represents a library whose documentation has been fetched from Context7
 * and cached locally for quick retrieval.
 *
 * @example
 * ```ts
 * const cachedLib: CachedLibrary = {
 *   id: 1,
 *   libraryId: "/vercel/next.js",
 *   name: "next.js",
 *   version: "v14.3.0",
 *   fetchedAt: "2025-12-24T10:00:00Z",
 *   expiresAt: "2025-12-31T10:00:00Z",
 *   totalSnippets: 150,
 *   isExpired: false
 * }
 * ```
 */
export interface CachedLibrary {
  /** Database primary key */
  id: number;

  /** Context7 library identifier (e.g., "/vercel/next.js" or "/vercel/next.js/v14.3.0") */
  libraryId: string;

  /** Human-readable library name (e.g., "next.js") */
  name: string;

  /** Specific version if included in Context7 ID, undefined for latest */
  version?: string;

  /** ISO 8601 timestamp when documentation was fetched */
  fetchedAt: string;

  /** ISO 8601 timestamp when cache expires (typically 7 days from fetch) */
  expiresAt: string;

  /** Total number of code snippets cached for this library */
  totalSnippets: number;

  /** Whether the cache has expired and should be refreshed */
  isExpired: boolean;
}

/**
 * Documentation section or page from a library.
 *
 * Represents a single page or section of documentation, typically
 * corresponding to one page from Context7's paginated API response.
 *
 * @example
 * ```ts
 * const section: DocSection = {
 *   id: 42,
 *   libraryId: "/vercel/next.js",
 *   topic: "routing",
 *   title: "Dynamic Routes",
 *   content: "In Next.js, you can create dynamic routes...",
 *   codeSnippets: ["export default function Page({ params }) {...}"],
 *   pageNumber: 1
 * }
 * ```
 */
export interface DocSection {
  /** Database primary key */
  id: number;

  /** Context7 library identifier this section belongs to */
  libraryId: string;

  /** Optional topic/category this section covers (e.g., "routing", "hooks") */
  topic?: string | undefined;

  /** Section or page title */
  title: string;

  /** Full text content of the documentation section */
  content: string;

  /** Array of code snippets extracted from this section */
  codeSnippets: string[];

  /** Page number from Context7 API pagination (1-indexed) */
  pageNumber: number;
}

/**
 * Search result with relevance scoring.
 *
 * Returned from semantic search operations, includes the matching
 * documentation section along with metadata and relevance score.
 *
 * @example
 * ```ts
 * const result: DocSearchResult = {
 *   section: { id: 42, libraryId: "/vercel/next.js", ... },
 *   libraryName: "next.js",
 *   relevance: 0.85
 * }
 * ```
 */
export interface DocSearchResult {
  /** The matching documentation section */
  section: DocSection;

  /** Human-readable library name for display */
  libraryName: string;

  /** Relevance score from 0.0 to 1.0, where 1.0 is most relevant */
  relevance: number;
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
 * Options for searching cached documentation.
 *
 * Controls search behavior including scope, filtering, and result limits.
 *
 * @example
 * ```ts
 * const options: DocsSearchOptions = {
 *   query: "how to use server actions",
 *   library: "next.js",
 *   topic: "server-components",
 *   limit: 10
 * }
 * ```
 */
export interface DocsSearchOptions {
  /** Natural language search query */
  query: string;

  /** Optional: limit search to specific library */
  library?: string | undefined;

  /** Optional: limit search to specific topic */
  topic?: string | undefined;

  /** Maximum number of results to return (defaults to 10) */
  limit?: number | undefined;
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

/**
 * Cache statistics and metadata.
 *
 * Provides overview of the current cache state, useful for
 * monitoring and maintenance operations.
 *
 * @example
 * ```ts
 * const stats: DocsCacheStats = {
 *   totalLibraries: 12,
 *   totalSections: 450,
 *   expiredCount: 2,
 *   oldestFetch: "2025-12-01T10:00:00Z",
 *   newestFetch: "2025-12-24T10:00:00Z"
 * }
 * ```
 */
export interface DocsCacheStats {
  /** Total number of libraries in cache */
  totalLibraries: number;

  /** Total number of documentation sections stored */
  totalSections: number;

  /** Number of expired library caches that need refresh */
  expiredCount: number;

  /** ISO timestamp of the oldest cached library, if any */
  oldestFetch?: string;

  /** ISO timestamp of the newest cached library, if any */
  newestFetch?: string;
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
