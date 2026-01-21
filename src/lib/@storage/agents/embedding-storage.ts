/**
 * @module lib/@storage/agents/embedding-storage
 * @description Agent embedding storage using shared semantic-search module
 *
 * Thin wrapper over shared semantic-search module with agent-specific APIs.
 * Uses shared factories for embedding storage and migration.
 */

import { getGlobalDatabase } from '../database';
import {
  bufferToEmbedding,
  createEmbeddingStorage,
  createMigrationRunner,
} from '../semantic-search';
import type { EmbeddingStorage, MigrationRunner } from '../semantic-search/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Agent entity for embedding generation
 */
interface AgentForEmbedding {
  id: number;
  name: string;
  description: string;
}

// ============================================================================
// SINGLETON INSTANCES
// ============================================================================

let embeddingStorageInstance: EmbeddingStorage<number> | null = null;
let migrationRunnerInstance: MigrationRunner<number> | null = null;

/**
 * Get or create embedding storage instance
 * Uses lazy initialization to avoid database access at import time
 */
function getEmbeddingStorage(): EmbeddingStorage<number> {
  if (!embeddingStorageInstance) {
    embeddingStorageInstance = createEmbeddingStorage({
      db: getGlobalDatabase(),
      tableName: 'agent_embeddings',
      entityIdColumn: 'agent_id',
      getAllQuery: () => ({
        sql: 'SELECT agent_id as entity_id, embedding, created_at FROM agent_embeddings',
        params: [],
      }),
    });
  }
  return embeddingStorageInstance;
}

/**
 * Get or create migration runner instance
 */
function getMigrationRunner(): MigrationRunner<number> {
  if (!migrationRunnerInstance) {
    migrationRunnerInstance = createMigrationRunner<number, AgentForEmbedding>({
      db: getGlobalDatabase(),
      storage: getEmbeddingStorage(),
      getMissingCountQuery: `
        SELECT COUNT(*) as count FROM agent_agents a
        LEFT JOIN agent_embeddings e ON a.id = e.agent_id
        WHERE e.agent_id IS NULL
      `,
      getWithoutEmbeddingsQuery: `
        SELECT a.id FROM agent_agents a
        LEFT JOIN agent_embeddings e ON a.id = e.agent_id
        WHERE e.agent_id IS NULL
        LIMIT ?
      `,
      getEntityQuery: 'SELECT id, name, description FROM agent_agents WHERE id = ?',
      extractText: (agent) => `${agent.name}: ${agent.description}`,
      extractId: (agent) => agent.id,
    });
  }
  return migrationRunnerInstance;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Store embedding for an agent
 *
 * @param agentId - ID of the agent
 * @param text - Text to embed (typically name + description)
 * @returns true if successful
 */
export async function storeAgentEmbedding(agentId: number, text: string): Promise<boolean> {
  return getEmbeddingStorage().store(agentId, text);
}

/**
 * Delete embedding for an agent
 */
export function deleteAgentEmbedding(agentId: number): void {
  getEmbeddingStorage().delete(agentId);
}

/**
 * Check if an agent has an embedding
 */
export function hasAgentEmbedding(agentId: number): boolean {
  return getEmbeddingStorage().has(agentId);
}

/**
 * Get embedding for an agent
 *
 * @returns Float32Array embedding or null if not found
 */
export function getAgentEmbedding(agentId: number): Float32Array | null {
  return getEmbeddingStorage().get(agentId);
}

/**
 * Get all agent embeddings
 *
 * @returns Map of agentId -> embedding
 */
export function getAllAgentEmbeddings(): Map<number, Float32Array> {
  const rows = getEmbeddingStorage().getAll();
  const embeddings = new Map<number, Float32Array>();
  for (const row of rows) {
    embeddings.set(row.entity_id, bufferToEmbedding(row.embedding));
  }
  return embeddings;
}

/**
 * Get count of agents with embeddings
 */
export function getAgentEmbeddingCount(): number {
  return getEmbeddingStorage().count();
}

/**
 * Get count of agents without embeddings
 */
export function getMissingAgentEmbeddingsCount(): number {
  return getMigrationRunner().getMissingCount();
}

/**
 * Backfill embeddings for agents without them
 *
 * @param onProgress - Progress callback
 * @returns Statistics about processed/failed
 */
export async function backfillAgentEmbeddings(
  onProgress?: (current: number, total: number) => void,
): Promise<{ processed: number; failed: number }> {
  const result = await getMigrationRunner().migrate(onProgress);
  return {
    processed: result.processed,
    failed: result.total - result.processed,
  };
}

/**
 * Start background migration (non-blocking)
 */
export function ensureAgentEmbeddingsMigrated(): void {
  getMigrationRunner().ensureMigrated();
}

/**
 * Check if semantic search is available for agents
 */
export function isAgentSemanticSearchAvailable(): boolean {
  return getAgentEmbeddingCount() > 0;
}
