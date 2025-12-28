/**
 * @module lib/integrations/context7/client
 * @description Direct HTTP client for Context7 API
 *
 * This module provides:
 * - Context7Client class for API interactions
 * - Library search functionality
 * - Documentation fetching with pagination
 * - Input validation and error handling
 */

const BASE_URL = 'https://context7.com/api';
const API_KEY_PREFIX = 'ctx7sk';

/** Default HTTP request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Maximum query length for input validation */
const MAX_QUERY_LENGTH = 500;

// ============================================================================
// Types
// ============================================================================

export interface Context7Config {
  apiKey?: string | undefined;
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  branch: string;
  lastUpdateDate: string;
  state: 'initial' | 'finalized' | 'processing' | 'error' | 'delete';
  totalTokens: number;
  totalSnippets: number;
  stars?: number;
  trustScore?: number;
  benchmarkScore?: number;
  versions?: string[];
}

export interface SearchLibraryResponse {
  results: SearchResult[];
  metadata: {
    authentication: 'none' | 'personal' | 'team';
  };
}

export interface CodeExample {
  language: string;
  code: string;
}

export interface CodeSnippet {
  codeTitle: string;
  codeDescription: string;
  codeLanguage: string;
  codeTokens: number;
  codeId: string;
  pageTitle: string;
  codeList: CodeExample[];
}

export interface InfoSnippet {
  pageId?: string;
  breadcrumb?: string;
  content: string;
  contentTokens: number;
}

export interface Pagination {
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CodeDocsResponse {
  snippets: CodeSnippet[];
  pagination: Pagination;
  totalTokens: number;
}

export interface InfoDocsResponse {
  snippets: InfoSnippet[];
  pagination: Pagination;
  totalTokens: number;
}

export interface GetDocsOptions {
  version?: string;
  page?: number;
  topic?: string;
  limit?: number;
  mode?: 'info' | 'code';
}

// ============================================================================
// Client
// ============================================================================

export class Context7Client {
  private apiKey: string;

  constructor(config: Context7Config = {}) {
    const apiKey = config.apiKey || process.env.CONTEXT7_API_KEY;

    if (!apiKey) {
      throw new Error(
        'Context7 API key is required. Set CONTEXT7_API_KEY environment variable or pass apiKey in config.',
      );
    }

    if (!apiKey.startsWith(API_KEY_PREFIX)) {
      console.warn(`API key should start with '${API_KEY_PREFIX}'`);
    }

    this.apiKey = apiKey;
  }

  /**
   * Search for libraries by name
   */
  async searchLibrary(query: string): Promise<SearchLibraryResponse> {
    // Input validation
    if (!query || typeof query !== 'string') {
      throw new Error('Search query is required');
    }

    const sanitizedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
    if (sanitizedQuery.length === 0) {
      throw new Error('Search query cannot be empty');
    }

    const url = new URL(`${BASE_URL}/v2/search`);
    url.searchParams.set('query', sanitizedQuery);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Context7 API error: ${response.status} ${response.statusText}`);
      }

      return response.json() as Promise<SearchLibraryResponse>;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Context7 API request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get documentation for a library
   * @param libraryId - Format: /owner/repo (e.g., /vercel/next.js)
   */
  async getDocs(
    libraryId: string,
    options: GetDocsOptions = {},
  ): Promise<CodeDocsResponse | InfoDocsResponse> {
    // Input validation
    if (!libraryId || typeof libraryId !== 'string') {
      throw new Error('Library ID is required');
    }

    // Clean and validate library ID
    const cleaned = libraryId.trim().startsWith('/') ? libraryId.trim().slice(1) : libraryId.trim();
    const parts = cleaned.split('/').filter(Boolean);

    if (parts.length < 2) {
      throw new Error(`Invalid library ID format: ${libraryId}. Expected format: /owner/repo`);
    }

    // Validate owner/repo format (alphanumeric, dots, hyphens, underscores)
    const validPattern = /^[\w.-]+$/;
    const owner = parts[0];
    const repo = parts[1];
    if (!owner || !repo || !validPattern.test(owner) || !validPattern.test(repo)) {
      throw new Error('Invalid characters in library ID');
    }

    const mode = options.mode || 'code';

    // Build endpoint: /v2/docs/{mode}/{owner}/{repo}[/{version}]
    const pathParts = ['v2', 'docs', mode, owner, repo];
    if (options.version) {
      const sanitizedVersion = options.version.trim().slice(0, 50);
      if (sanitizedVersion && validPattern.test(sanitizedVersion)) {
        pathParts.push(sanitizedVersion);
      }
    }

    const url = new URL(`${BASE_URL}/${pathParts.join('/')}`);

    // Query params with validation
    url.searchParams.set('type', 'json');
    if (options.topic) {
      const sanitizedTopic = options.topic.trim().slice(0, 100);
      if (sanitizedTopic) {
        url.searchParams.set('topic', sanitizedTopic);
      }
    }
    if (options.page !== undefined && options.page >= 1) {
      url.searchParams.set('page', String(Math.floor(options.page)));
    }
    if (options.limit !== undefined && options.limit >= 1 && options.limit <= 100) {
      url.searchParams.set('limit', String(Math.floor(options.limit)));
    }

    const fullUrl = url.toString();

    // Debug logging (without exposing API key)
    if (process.env.DEBUG) {
      console.error('[Context7] GET', fullUrl);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(
          `Context7 API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`,
        );
      }

      return response.json() as Promise<CodeDocsResponse | InfoDocsResponse>;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Context7 API request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Check if Context7 API key is configured
 */
export function hasContext7ApiKey(): boolean {
  return !!process.env.CONTEXT7_API_KEY;
}

/**
 * Create a Context7 client instance
 */
export function createContext7Client(apiKey?: string): Context7Client {
  return new Context7Client({ apiKey });
}
