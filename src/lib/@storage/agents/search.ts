/**
 * @module lib/@storage/agents/search
 * @description Hybrid search for agents (BM25 + semantic)
 *
 * Uses shared semantic-search module for embedding storage and hybrid algorithm.
 * Adds agent-specific scoring boosts (category, history).
 *
 * Search Pipeline:
 * 1. BM25 search via FTS5 (fast keyword matching)
 * 2. Semantic search via embeddings (meaning-based matching)
 * 3. Shared hybrid scoring: base = (bm25 * w1) + (semantic * w2)
 * 4. Agent-specific boosts: final = base + categoryBoost + historyBoost
 * 5. Filter and rank results
 */

import { logger } from '@/lib/@core/logger';

import { getGlobalDatabase, prepareStatement } from '../database';
import { generateEmbedding } from '../memory/embeddings';
import { cosineSimilarity, hybridSearch as sharedHybridSearch } from '../semantic-search';
import type {
  SearchResult,
  HybridSearchOptions as SharedHybridOptions,
} from '../semantic-search/types';
import {
  ensureAgentEmbeddingsMigrated,
  getAllAgentEmbeddings,
  isAgentSemanticSearchAvailable,
} from './embedding-storage';
import type {
  AgentRow,
  AgentScoreBreakdown,
  AgentSearchOptions,
  AgentSearchResult,
  StoredAgent,
} from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Default search options
 */
const DEFAULTS = {
  limit: 10,
  minScore: 20,
  bm25Weight: 0.4,
  semanticWeight: 0.4,
  project: '',
  feature: '',
} as const;

// ============================================================================
// CONVERTERS
// ============================================================================

/**
 * Convert AgentRow to StoredAgent
 */
function rowToAgent(row: AgentRow): StoredAgent {
  return {
    id: row.id,
    uniqueId: row.unique_id,
    name: row.name,
    description: row.description,
    content: row.content,
    category: row.category as StoredAgent['category'],
    plugin: row.plugin,
    filePath: row.file_path,
    contentHash: row.content_hash,
    model: row.model as StoredAgent['model'],
    keywords: JSON.parse(row.keywords),
    techStack: JSON.parse(row.tech_stack),
    projectTypes: JSON.parse(row.project_types),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    syncedAt: row.synced_at,
  };
}

// ============================================================================
// BM25 SEARCH
// ============================================================================

/**
 * Agent entity for hybrid search
 * Extends StoredAgent with index signature for SearchableEntity compatibility
 */
interface SearchableAgent extends StoredAgent {
  /** Index signature for SearchableEntity */
  [key: string]: unknown;
}

/**
 * Prepare query for FTS5
 */
function prepareFtsQuery(query: string): string {
  // Split into words and filter short ones
  const words = query
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return '*';

  // Use OR for broader matching, with prefix matching
  return words.map((w) => `"${w}"*`).join(' OR ');
}

/**
 * Search agents using BM25 (FTS5)
 * Returns results in shared SearchResult format
 */
function searchBM25(query: string, limit: number): SearchResult<SearchableAgent>[] {
  const db = getGlobalDatabase();

  // FTS5 BM25 search with relevance ranking
  const sql = `
    SELECT
      a.*,
      -bm25(agent_agents_fts, 2.0, 1.0, 1.0, 0.5) as rank
    FROM agent_agents_fts f
    JOIN agent_agents a ON a.id = f.rowid
    WHERE agent_agents_fts MATCH ?
    ORDER BY rank DESC
    LIMIT ?
  `;

  try {
    const ftsQuery = prepareFtsQuery(query);
    const rows = prepareStatement<[string, number], AgentRow & { rank: number }>(db, sql).all(
      ftsQuery,
      limit * 2,
    );

    if (rows.length === 0) return [];

    // Normalize scores to 0-100 range for shared algorithm
    const maxRank = Math.max(...rows.map((r) => r.rank), 0.01);

    return rows.map((row) => ({
      entity: { ...rowToAgent(row), id: row.id } as SearchableAgent,
      relevance: (row.rank / maxRank) * 100,
    }));
  } catch (error) {
    logger.debug(`BM25 search failed: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

// ============================================================================
// SEMANTIC SEARCH
// ============================================================================

/**
 * Semantic search result
 */
interface SemanticResult {
  entityId: number;
  similarity: number;
}

/**
 * Search agents using semantic similarity
 * Returns results in shared SemanticSearchResult format
 */
async function searchSemantic(query: string, limit: number): Promise<SemanticResult[]> {
  if (!isAgentSemanticSearchAvailable()) {
    return [];
  }

  try {
    // Generate query embedding
    const queryResult = await generateEmbedding(query);
    if (!queryResult.embedding) return [];

    // Get all agent embeddings
    const agentEmbeddings = getAllAgentEmbeddings();
    if (agentEmbeddings.size === 0) return [];

    // Calculate similarities
    const results: SemanticResult[] = [];
    for (const [agentId, embedding] of agentEmbeddings) {
      const similarity = cosineSimilarity(queryResult.embedding, embedding);
      if (similarity > 0.2) {
        results.push({ entityId: agentId, similarity });
      }
    }

    // Sort and limit
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit * 2);
  } catch (error) {
    logger.debug(
      `Semantic search failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

// ============================================================================
// AGENT-SPECIFIC BOOSTS
// ============================================================================

/**
 * Category-related keywords for boosting
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  security: ['security', 'audit', 'vulnerability', 'penetration', 'owasp', 'secure'],
  performance: ['performance', 'optimization', 'speed', 'latency', 'benchmark'],
  architecture: ['architecture', 'design', 'pattern', 'structure', 'system'],
  quality: ['quality', 'review', 'refactor', 'clean', 'lint', 'test'],
  debugging: ['debug', 'error', 'bug', 'issue', 'fix', 'troubleshoot'],
  docs: ['documentation', 'readme', 'api doc', 'swagger', 'comment'],
  frontend: ['ui', 'ux', 'component', 'css', 'react', 'vue', 'frontend'],
  backend: ['api', 'endpoint', 'server', 'database', 'backend'],
  devops: ['deploy', 'ci', 'docker', 'kubernetes', 'infrastructure'],
  database: ['database', 'schema', 'query', 'migration', 'sql'],
};

/**
 * Get category boost (max 10 points)
 */
function getCategoryBoost(agent: StoredAgent, query: string): number {
  const normalizedQuery = query.toLowerCase();
  const category = agent.category.toLowerCase();

  // Direct category mention
  if (normalizedQuery.includes(category)) {
    return 10;
  }

  // Category-related keywords
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  for (const kw of keywords) {
    if (normalizedQuery.includes(kw)) {
      return 7; // Partial match
    }
  }

  return 0;
}

/**
 * Get history boost based on recent usage (max 10 points)
 */
function getHistoryBoost(agentId: number, project: string, feature: string): number {
  if (!project) return 0;

  const db = getGlobalDatabase();

  // Count recent successful uses (last 30 days)
  const sql = `
    SELECT COUNT(*) as count
    FROM agent_usage
    WHERE agent_id = ?
      AND project = ?
      AND success = 1
      AND datetime(used_at) > datetime('now', '-30 days')
  `;

  const row = prepareStatement<[number, string], { count: number }>(db, sql).get(agentId, project);
  const recentUses = row?.count ?? 0;

  let boost = 0;
  if (recentUses > 5) boost = 8;
  else if (recentUses > 2) boost = 5;
  else if (recentUses > 0) boost = 3;

  // Feature match bonus
  if (feature) {
    const featureSql = `
      SELECT 1 FROM agent_usage
      WHERE agent_id = ? AND feature LIKE ? AND success = 1
      LIMIT 1
    `;
    const featureMatch = prepareStatement<[number, string]>(db, featureSql).get(
      agentId,
      `%${feature}%`,
    );
    if (featureMatch) {
      boost += 2;
    }
  }

  return Math.min(boost, 10);
}

// ============================================================================
// MAIN SEARCH
// ============================================================================

/**
 * Merged options type for internal use
 */
interface MergedOptions {
  limit: number;
  minScore: number;
  bm25Weight: number;
  semanticWeight: number;
  project: string;
  feature: string;
  category?: AgentSearchOptions['category'];
}

/**
 * Search agents with hybrid scoring
 *
 * Uses shared hybrid algorithm + agent-specific boosts.
 *
 * @param query - Search query (task description)
 * @param options - Search options
 * @returns Sorted array of search results with relevance scores
 */
export async function searchAgents(
  query: string,
  options: AgentSearchOptions = {},
): Promise<AgentSearchResult[]> {
  const opts: MergedOptions = { ...DEFAULTS, ...options };

  // Start background migration for existing agents (non-blocking)
  ensureAgentEmbeddingsMigrated();

  // Run BM25 and semantic search in parallel
  const [bm25Results, semanticResults] = await Promise.all([
    Promise.resolve(searchBM25(query, opts.limit)),
    searchSemantic(query, opts.limit),
  ]);

  // If no results from either, use fallback
  if (bm25Results.length === 0 && semanticResults.length === 0) {
    logger.debug('No BM25/semantic matches, falling back to category match');
    return fallbackSearch(query, opts);
  }

  // Use shared hybrid algorithm for base scoring
  const sharedOptions: SharedHybridOptions = {
    bm25Weight: opts.bm25Weight,
    semanticWeight: opts.semanticWeight,
    minSimilarity: 0.2,
    limit: opts.limit * 2, // Get more to allow for filtering
  };

  const hybridResults = sharedHybridSearch(query, bm25Results, semanticResults, sharedOptions);

  // Apply agent-specific boosts and filtering
  const results: AgentSearchResult[] = [];

  for (const result of hybridResults) {
    const agent = result.entity as SearchableAgent;

    // Skip if category filter doesn't match
    if (opts.category && agent.category !== opts.category) {
      continue;
    }

    // Calculate agent-specific boosts
    const categoryBoost = getCategoryBoost(agent, query);
    const historyBoost = getHistoryBoost(agent.id, opts.project, opts.feature);

    // Get original scores for breakdown
    const bm25Score = bm25Results.find((r) => r.entity.id === agent.id)?.relevance ?? 0;
    const semanticData = semanticResults.find((r) => r.entityId === agent.id);

    // Final score = hybrid base + boosts (max ~100)
    const baseScore = result.relevance * 0.8; // Scale down to leave room for boosts
    const relevance = Math.min(100, baseScore + categoryBoost + historyBoost);

    const breakdown: AgentScoreBreakdown = {
      bm25Score: Math.round(bm25Score * 0.4), // Scaled BM25
      semanticScore: Math.round((semanticData?.similarity ?? 0) * 40), // Scaled semantic
      categoryBoost,
      historyBoost,
      ...(semanticData && { similarity: semanticData.similarity }),
    };

    if (relevance >= opts.minScore) {
      results.push({
        agent,
        relevance: Math.round(relevance),
        breakdown,
      });
    }
  }

  // Sort by relevance descending
  results.sort((a, b) => b.relevance - a.relevance);

  return results.slice(0, opts.limit);
}

/**
 * Fallback search when BM25/semantic return no results
 */
async function fallbackSearch(query: string, opts: MergedOptions): Promise<AgentSearchResult[]> {
  const db = getGlobalDatabase();

  // Get all agents and score by category match
  let sql = 'SELECT * FROM agent_agents';
  const params: string[] = [];

  if (opts.category) {
    sql += ' WHERE category = ?';
    params.push(opts.category);
  }

  sql += ' LIMIT 50';

  const rows = prepareStatement<string[], AgentRow>(db, sql).all(...params);
  const results: AgentSearchResult[] = [];

  for (const row of rows) {
    const agent = rowToAgent(row);
    const categoryBoost = getCategoryBoost(agent, query);
    const historyBoost = getHistoryBoost(row.id, opts.project, opts.feature);

    const relevance = categoryBoost + historyBoost;

    if (relevance > 0) {
      results.push({
        agent,
        relevance: Math.round(relevance),
        breakdown: {
          bm25Score: 0,
          semanticScore: 0,
          categoryBoost,
          historyBoost,
        },
      });
    }
  }

  results.sort((a, b) => b.relevance - a.relevance);
  return results.slice(0, opts.limit);
}

// ============================================================================
// USAGE TRACKING
// ============================================================================

/**
 * Record agent usage for history boosting
 */
export function recordAgentUsage(
  agentId: number,
  project: string,
  feature?: string,
  success = true,
): void {
  const db = getGlobalDatabase();
  const sql = `
    INSERT INTO agent_usage (agent_id, project, feature, success)
    VALUES (?, ?, ?, ?)
  `;
  prepareStatement<[number, string, string | null, number]>(db, sql).run(
    agentId,
    project,
    feature ?? null,
    success ? 1 : 0,
  );
}

// ============================================================================
// RE-EXPORTS FROM EMBEDDING STORAGE
// ============================================================================

export {
  backfillAgentEmbeddings,
  getAgentEmbeddingCount,
  isAgentSemanticSearchAvailable as isSemanticSearchAvailable,
  storeAgentEmbedding,
} from './embedding-storage';
