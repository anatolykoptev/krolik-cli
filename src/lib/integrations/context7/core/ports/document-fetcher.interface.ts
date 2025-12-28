/**
 * @module lib/integrations/context7/core/ports/document-fetcher.interface
 * @description Interface for fetching documentation from external APIs
 *
 * Abstracts the Context7 API client to enable testing and alternative
 * documentation sources.
 */

import type {
  CodeDocsResponse,
  GetDocsOptions,
  InfoDocsResponse,
  SearchResult,
} from '../../client';

/**
 * Response from documentation fetch.
 */
export type DocsResponse = CodeDocsResponse | InfoDocsResponse;

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
