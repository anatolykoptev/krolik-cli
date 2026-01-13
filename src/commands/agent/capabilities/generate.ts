/**
 * @module commands/agent/capabilities/generate
 * @description Generate and manage agent capabilities index
 */

import { exists, readJson, writeJson } from '@/lib/@core/fs';
import { getKrolikFilePath } from '@/lib/@core/krolik-paths';
import { logger } from '@/lib/@core/logger';
import {
  generateEmbedding,
  isEmbeddingsAvailable,
  isEmbeddingsLoading,
  preloadEmbeddingPool,
} from '@/lib/@storage/memory/embeddings';
import { loadAllAgents } from '../loader';
import { parseAllAgentCapabilities } from './parser';
import type { AgentCapabilities, CapabilitiesIndex } from './types';

/** Current index version - bump when changing embedding format */
const INDEX_VERSION = '2.0.0';

/** Index file name */
const INDEX_FILE = 'agent-capabilities.json';

/** Maximum time to wait for embeddings to load (ms) */
const EMBEDDING_INIT_TIMEOUT_MS = 5000;

/**
 * Wait for embeddings to become available
 */
async function waitForEmbeddings(): Promise<boolean> {
  if (isEmbeddingsAvailable()) {
    return true;
  }

  if (!isEmbeddingsLoading()) {
    preloadEmbeddingPool();
  }

  const startTime = Date.now();
  while (Date.now() - startTime < EMBEDDING_INIT_TIMEOUT_MS) {
    if (isEmbeddingsAvailable()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return isEmbeddingsAvailable();
}

/**
 * Generate capabilities index from agents path
 * Now includes pre-computed embeddings for instant semantic matching
 */
export async function generateCapabilitiesIndex(agentsPath: string): Promise<CapabilitiesIndex> {
  const allAgents = loadAllAgents(agentsPath);
  const capabilities = parseAllAgentCapabilities(allAgents);

  // Try to generate embeddings for all agents
  const embeddingsAvailable = await waitForEmbeddings();
  let embeddingsGenerated = 0;

  if (embeddingsAvailable) {
    logger.info('Generating embeddings for agents...');

    // Generate embeddings in parallel batches of 10
    const BATCH_SIZE = 10;
    for (let i = 0; i < capabilities.length; i += BATCH_SIZE) {
      const batch = capabilities.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (cap) => {
          try {
            const result = await generateEmbedding(cap.description);
            // Store as regular array for JSON serialization
            cap.embedding = Array.from(result.embedding);
            embeddingsGenerated++;
          } catch {
            // Silently skip - agent will use keyword-only matching
          }
        }),
      );
    }
  }

  const index: CapabilitiesIndex = {
    version: INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    agentsPath,
    totalAgents: capabilities.length,
    agents: capabilities,
  };

  // Save to user-level .krolik directory
  const indexPath = getKrolikFilePath(INDEX_FILE, 'user');
  const success = writeJson(indexPath, index, 2);

  if (success) {
    logger.success(`Generated capabilities for ${capabilities.length} agents`);
    if (embeddingsGenerated > 0) {
      logger.info(`Pre-computed embeddings for ${embeddingsGenerated} agents`);
    }
    logger.info(`Index saved to: ${indexPath}`);
  } else {
    logger.warn('Failed to save capabilities index');
  }

  return index;
}

/**
 * Load capabilities index (with auto-generation if missing)
 */
export async function loadCapabilitiesIndex(
  agentsPath: string,
  forceRegenerate = false,
): Promise<AgentCapabilities[]> {
  const indexPath = getKrolikFilePath(INDEX_FILE, 'user');

  // Check if index exists and is valid
  if (!forceRegenerate && exists(indexPath)) {
    const index = readJson<CapabilitiesIndex>(indexPath);

    if (index && index.version === INDEX_VERSION && index.agents.length > 0) {
      // Verify agents path matches (in case user switched projects)
      if (index.agentsPath === agentsPath) {
        return index.agents;
      }
    }
  }

  // Auto-generate on first use or if path changed
  const index = await generateCapabilitiesIndex(agentsPath);
  return index.agents;
}

/**
 * Get index file path
 */
export function getIndexPath(): string {
  return getKrolikFilePath(INDEX_FILE, 'user');
}

/**
 * Check if index needs regeneration
 */
export function needsRegeneration(agentsPath: string): boolean {
  const indexPath = getKrolikFilePath(INDEX_FILE, 'user');

  if (!exists(indexPath)) {
    return true;
  }

  const index = readJson<CapabilitiesIndex>(indexPath);

  if (!index || index.version !== INDEX_VERSION) {
    return true;
  }

  if (index.agentsPath !== agentsPath) {
    return true;
  }

  return false;
}

/**
 * Get capabilities for a specific agent by name
 */
export async function getAgentCapabilities(
  agentsPath: string,
  agentName: string,
): Promise<AgentCapabilities | null> {
  const capabilities = await loadCapabilitiesIndex(agentsPath);
  return capabilities.find((c) => c.name === agentName) ?? null;
}

/**
 * Search capabilities by keyword
 */
export async function searchCapabilities(
  agentsPath: string,
  query: string,
): Promise<AgentCapabilities[]> {
  const capabilities = await loadCapabilitiesIndex(agentsPath);
  const normalizedQuery = query.toLowerCase();

  return capabilities.filter(
    (c) =>
      c.name.toLowerCase().includes(normalizedQuery) ||
      c.description.toLowerCase().includes(normalizedQuery) ||
      c.keywords.some((k) => k.toLowerCase().includes(normalizedQuery)) ||
      c.techStack.some((t) => t.toLowerCase().includes(normalizedQuery)),
  );
}
