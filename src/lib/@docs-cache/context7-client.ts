/**
 * @module @docs-cache/context7-client
 * @description Direct HTTP client for Context7 API
 */

const BASE_URL = 'https://context7.com/api';
const API_KEY_PREFIX = 'ctx7sk';

// ============================================================================
// Types
// ============================================================================

export interface Context7Config {
  apiKey?: string;
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
    const url = new URL(`${BASE_URL}/v2/search`);
    url.searchParams.set('query', query);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Context7 API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<SearchLibraryResponse>;
  }

  /**
   * Get documentation for a library
   * @param libraryId - Format: /owner/repo (e.g., /vercel/next.js)
   */
  async getDocs(
    libraryId: string,
    options: GetDocsOptions = {},
  ): Promise<CodeDocsResponse | InfoDocsResponse> {
    // Clean library ID
    const cleaned = libraryId.startsWith('/') ? libraryId.slice(1) : libraryId;
    const parts = cleaned.split('/');

    if (parts.length < 2) {
      throw new Error(`Invalid library ID format: ${libraryId}. Expected format: /owner/repo`);
    }

    const [owner, repo] = parts;
    const mode = options.mode || 'code';

    // Build endpoint: /v2/docs/{mode}/{owner}/{repo}[/{version}]
    const pathParts = ['v2', 'docs', mode, owner, repo];
    if (options.version) {
      pathParts.push(options.version);
    }

    const url = new URL(`${BASE_URL}/${pathParts.join('/')}`);

    // Query params
    url.searchParams.set('type', 'json');
    if (options.topic) {
      url.searchParams.set('topic', options.topic);
    }
    if (options.page !== undefined) {
      url.searchParams.set('page', String(options.page));
    }
    if (options.limit !== undefined) {
      url.searchParams.set('limit', String(options.limit));
    }

    const fullUrl = url.toString();

    // Debug logging
    if (process.env.DEBUG) {
      console.error('[Context7] GET', fullUrl);
    }

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Context7 API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`,
      );
    }

    return response.json() as Promise<CodeDocsResponse | InfoDocsResponse>;
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
