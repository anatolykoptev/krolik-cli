/**
 * @module lib/@storage/agents
 * @description SQLite storage for agents with hybrid search
 *
 * Provides persistent storage for agent definitions with:
 * - Incremental file system sync (hash-based change detection)
 * - Hybrid search (BM25 keyword + semantic embeddings)
 * - Usage history tracking for relevance boosting
 *
 * Usage:
 * ```typescript
 * import {
 *   syncAgentsIfNeeded,
 *   searchAgents,
 *   backfillAgentEmbeddings,
 * } from '@/lib/@storage/agents';
 *
 * // Sync agents from file system
 * syncAgentsIfNeeded(projectRoot);
 *
 * // Backfill embeddings for semantic search
 * await backfillAgentEmbeddings();
 *
 * // Search with hybrid scoring
 * const results = await searchAgents('security audit for authentication', {
 *   limit: 5,
 *   project: 'my-project',
 * });
 * ```
 */

// Search operations
export {
  backfillAgentEmbeddings,
  getAgentEmbeddingCount,
  isSemanticSearchAvailable,
  recordAgentUsage,
  searchAgents,
  storeAgentEmbedding,
} from './search';

// Sync operations
export {
  clearAllAgents,
  getAgentByName,
  getAgentCount,
  getAgentsByCategory,
  getAllAgents,
  isSyncNeeded,
  syncAgentsIfNeeded,
  syncAgentsToDatabase,
} from './sync';
// Types
export type {
  AgentRow,
  AgentScoreBreakdown,
  AgentSearchOptions,
  AgentSearchResult,
  AgentSyncResult,
  AgentUsage,
  AgentWithEmbedding,
  StoredAgent,
} from './types';
