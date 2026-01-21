/**
 * @module lib/@cloud/hully-client
 * @description GraphQL client for hully.one platform
 *
 * Connects krolik-cli MCP to cloud-based:
 * - PostgreSQL + pgvector (semantic search)
 * - Embedding service (all-MiniLM-L6-v2)
 * - Document generation (n8n workflows)
 */

// graphql-request is an optional dependency - install with: pnpm add graphql-request graphql
// @ts-expect-error - optional dependency, may not be installed
import { GraphQLClient, gql } from 'graphql-request';

// ============================================================================
// Types
// ============================================================================

export interface HullyConfig {
  endpoint?: string;
  adminSecret?: string;
  embeddingServiceUrl?: string;
}

export interface DocSection {
  id: number;
  title: string;
  content: string;
  library_name: string;
  document_type: string;
  jurisdiction: string | null;
}

export interface SemanticSearchResult extends DocSection {
  similarity: number;
}

export interface SearchOptions {
  documentType?: 'legal' | 'technical' | 'general' | 'personal';
  jurisdiction?: string;
  minSimilarity?: number;
  limit?: number;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimension: number;
}

export interface Library {
  library_id: string;
  library_name: string;
  description: string | null;
  document_type: string;
  jurisdiction: string | null;
  version: string | null;
  sections_count: number;
}

// ============================================================================
// GraphQL Queries
// ============================================================================

const SEMANTIC_SEARCH_QUERY = gql`
  query SemanticSearchDocs(
    $queryEmbedding: String!
    $minSimilarity: Float
    $limit: Int
    $documentType: String
    $jurisdiction: String
  ) {
    semantic_search_docs(
      args: {
        query_embedding: $queryEmbedding
        min_similarity: $minSimilarity
        result_limit: $limit
        filter_document_type: $documentType
        filter_jurisdiction: $jurisdiction
      }
    ) {
      section_id
      title
      content
      library_name
      document_type
      jurisdiction
      similarity
    }
  }
`;

const KEYWORD_SEARCH_QUERY = gql`
  query KeywordSearchDocs(
    $keyword: String!
    $documentType: String
    $limit: Int
  ) {
    doc_sections(
      where: {
        _and: [
          { content: { _ilike: $keyword } }
          { library: { document_type: { _eq: $documentType } } }
        ]
      }
      order_by: { page_number: asc }
      limit: $limit
    ) {
      id
      title
      content
      library {
        library_name
        jurisdiction
        document_type
      }
    }
  }
`;

const GET_LIBRARIES_QUERY = gql`
  query GetLibraries($documentType: String) {
    library_docs(
      where: { document_type: { _eq: $documentType } }
      order_by: { library_name: asc }
    ) {
      library_id
      library_name
      description
      jurisdiction
      document_type
      version
      sections_aggregate {
        aggregate {
          count
        }
      }
    }
  }
`;

// ============================================================================
// HullyClient Class
// ============================================================================

export class HullyClient {
  private graphql: GraphQLClient;
  private embeddingServiceUrl: string;

  constructor(config: HullyConfig = {}) {
    const endpoint =
      config.endpoint || process.env.HULLY_API_ENDPOINT || 'https://api.hully.one/v1/graphql';
    const adminSecret = config.adminSecret || process.env.HASURA_ADMIN_SECRET || '';

    this.graphql = new GraphQLClient(endpoint, {
      headers: {
        'x-hasura-admin-secret': adminSecret,
      },
    });

    this.embeddingServiceUrl =
      config.embeddingServiceUrl ||
      process.env.EMBEDDING_SERVICE_URL ||
      'http://embedding-service:8000';
  }

  // ==========================================================================
  // Embedding Generation
  // ==========================================================================

  /**
   * Generate embeddings for a batch of texts
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.embeddingServiceUrl}/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, normalize: true }),
    });

    if (!response.ok) {
      throw new Error(`Embedding service error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as EmbeddingResponse;
    return data.embeddings;
  }

  /**
   * Generate single embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const embeddings = await this.generateEmbeddings([text]);
    const embedding = embeddings[0];
    if (!embedding) {
      throw new Error('No embedding returned from service');
    }
    return embedding;
  }

  // ==========================================================================
  // Semantic Search
  // ==========================================================================

  /**
   * Semantic search using pgvector cosine similarity
   */
  async semanticSearch(
    query: string,
    options: SearchOptions = {},
  ): Promise<SemanticSearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query);

    // Format as pgvector string
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Execute GraphQL query
    const variables = {
      queryEmbedding: embeddingStr,
      minSimilarity: options.minSimilarity ?? 0.3,
      limit: options.limit ?? 10,
      documentType: options.documentType,
      jurisdiction: options.jurisdiction,
    };

    const data = await this.graphql.request<{ semantic_search_docs: SemanticSearchResult[] }>(
      SEMANTIC_SEARCH_QUERY,
      variables,
    );

    return data.semantic_search_docs;
  }

  // ==========================================================================
  // Keyword Search
  // ==========================================================================

  /**
   * Keyword-based full-text search (BM25)
   */
  async keywordSearch(keyword: string, options: SearchOptions = {}): Promise<DocSection[]> {
    const variables = {
      keyword: `%${keyword}%`,
      documentType: options.documentType,
      limit: options.limit ?? 10,
    };

    interface KeywordSearchSection {
      id: number;
      title: string;
      content: string;
      library: {
        library_name: string;
        jurisdiction: string;
        document_type: string;
      };
    }

    const data = await this.graphql.request<{
      doc_sections: KeywordSearchSection[];
    }>(KEYWORD_SEARCH_QUERY, variables);

    return data.doc_sections.map((section: KeywordSearchSection) => ({
      id: section.id,
      title: section.title,
      content: section.content,
      library_name: section.library.library_name,
      document_type: section.library.document_type,
      jurisdiction: section.library.jurisdiction,
    }));
  }

  // ==========================================================================
  // Hybrid Search (BM25 + Semantic)
  // ==========================================================================

  /**
   * Hybrid search: combines keyword matching (BM25) and semantic similarity
   */
  async hybridSearch(
    query: string,
    options: SearchOptions & { semanticWeight?: number; bm25Weight?: number } = {},
  ): Promise<SemanticSearchResult[]> {
    const semanticWeight = options.semanticWeight ?? 0.5;
    const bm25Weight = options.bm25Weight ?? 0.5;

    // Run both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(query, { ...options, limit: 20 }),
      this.keywordSearch(query, { ...options, limit: 20 }),
    ]);

    // Merge and re-rank results
    const merged = new Map<number, SemanticSearchResult>();

    // Add semantic results (normalized similarity 0-1)
    for (const result of semanticResults) {
      merged.set(result.id, {
        ...result,
        similarity: result.similarity * semanticWeight,
      });
    }

    // Add keyword results (binary match: 1 if found, 0 otherwise)
    for (const result of keywordResults) {
      const existing = merged.get(result.id);
      if (existing) {
        // Boost if found in both searches
        existing.similarity += bm25Weight;
      } else {
        // Add with BM25 weight only
        merged.set(result.id, {
          ...result,
          similarity: bm25Weight,
        });
      }
    }

    // Sort by combined score and apply limit
    const sorted = Array.from(merged.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, options.limit ?? 10);

    return sorted;
  }

  // ==========================================================================
  // Library Management
  // ==========================================================================

  /**
   * Get all libraries by document type
   */
  async getLibraries(
    documentType?: 'legal' | 'technical' | 'general' | 'personal',
  ): Promise<Library[]> {
    interface LibraryDoc {
      library_id: string;
      library_name: string;
      description: string | null;
      jurisdiction: string | null;
      document_type: string;
      version: string | null;
      sections_aggregate: {
        aggregate: {
          count: number;
        };
      };
    }

    const data = await this.graphql.request<{
      library_docs: LibraryDoc[];
    }>(GET_LIBRARIES_QUERY, { documentType });

    return data.library_docs.map((lib: LibraryDoc) => ({
      library_id: lib.library_id,
      library_name: lib.library_name,
      description: lib.description,
      document_type: lib.document_type,
      jurisdiction: lib.jurisdiction,
      version: lib.version,
      sections_count: lib.sections_aggregate.aggregate.count,
    }));
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  /**
   * Check if hully.one services are healthy
   */
  async healthCheck(): Promise<{
    graphql: boolean;
    embeddings: boolean;
  }> {
    const results = {
      graphql: false,
      embeddings: false,
    };

    // Test GraphQL
    try {
      await this.graphql.request(gql`
        query {
          __typename
        }
      `);
      results.graphql = true;
    } catch {
      results.graphql = false;
    }

    // Test Embedding Service
    try {
      const response = await fetch(`${this.embeddingServiceUrl}/health`);
      results.embeddings = response.ok;
    } catch {
      results.embeddings = false;
    }

    return results;
  }
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Singleton instance
 */
let defaultClient: HullyClient | null = null;

export function getHullyClient(config?: HullyConfig): HullyClient {
  if (!defaultClient) {
    defaultClient = new HullyClient(config);
  }
  return defaultClient;
}
