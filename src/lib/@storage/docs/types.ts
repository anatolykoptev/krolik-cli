/**
 * @module lib/@storage/docs/types
 * @description Type definitions for the docs cache storage module
 *
 * This module provides local caching for Context7 library documentation,
 * enabling faster access and offline support for AI-powered code analysis.
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
