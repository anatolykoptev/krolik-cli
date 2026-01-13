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

/** Track if background embedding generation is in progress */
let backgroundEmbeddingGeneration: Promise<void> | null = null;

/**
 * Generate capabilities index from agents path (FAST - no embeddings)
 *
 * Two-phase initialization:
 * 1. Phase 1 (instant): Generate index without embeddings - keyword search works immediately
 * 2. Phase 2 (background): Generate embeddings and update index asynchronously
 *
 * This ensures first-time users get instant response while embeddings generate in background.
 */
export async function generateCapabilitiesIndex(agentsPath: string): Promise<CapabilitiesIndex> {
  const allAgents = loadAllAgents(agentsPath);
  const capabilities = parseAllAgentCapabilities(allAgents);

  // Phase 1: Create index immediately WITHOUT embeddings
  const index: CapabilitiesIndex = {
    version: INDEX_VERSION,
    generatedAt: new Date().toISOString(),
    agentsPath,
    totalAgents: capabilities.length,
    agents: capabilities,
  };

  // Save index immediately (keyword search works right away)
  const indexPath = getKrolikFilePath(INDEX_FILE, 'user');
  const success = writeJson(indexPath, index, 2);

  if (success) {
    logger.success(`Generated capabilities for ${capabilities.length} agents`);
    logger.info(`Index saved to: ${indexPath}`);

    // Phase 2: Start background embedding generation (non-blocking)
    scheduleEmbeddingGeneration(agentsPath, capabilities, indexPath);
  } else {
    logger.warn('Failed to save capabilities index');
  }

  return index;
}

/**
 * Schedule background embedding generation
 * Runs asynchronously without blocking the main flow
 */
function scheduleEmbeddingGeneration(
  agentsPath: string,
  capabilities: AgentCapabilities[],
  indexPath: string,
): void {
  // Don't schedule if already in progress
  if (backgroundEmbeddingGeneration) return;

  backgroundEmbeddingGeneration = (async () => {
    try {
      // Wait for embedding model to be ready
      if (!isEmbeddingsLoading()) {
        preloadEmbeddingPool();
      }

      // Wait up to 10 seconds for embeddings to become available
      const startTime = Date.now();
      while (Date.now() - startTime < 10000) {
        if (isEmbeddingsAvailable()) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!isEmbeddingsAvailable()) {
        logger.warn('Embedding model not available, skipping semantic indexing');
        return;
      }

      logger.info('Generating embeddings in background...');
      let embeddingsGenerated = 0;

      // Generate embeddings in parallel batches of 10
      const BATCH_SIZE = 10;
      for (let i = 0; i < capabilities.length; i += BATCH_SIZE) {
        const batch = capabilities.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(async (cap) => {
            try {
              const result = await generateEmbedding(cap.description);
              cap.embedding = Array.from(result.embedding);
              embeddingsGenerated++;
            } catch {
              // Silently skip - agent will use keyword-only matching
            }
          }),
        );
      }

      // Update index with embeddings
      if (embeddingsGenerated > 0) {
        const updatedIndex: CapabilitiesIndex = {
          version: INDEX_VERSION,
          generatedAt: new Date().toISOString(),
          agentsPath,
          totalAgents: capabilities.length,
          agents: capabilities,
        };

        writeJson(indexPath, updatedIndex, 2);
        logger.success(`Pre-computed embeddings for ${embeddingsGenerated} agents`);
      }
    } catch (error) {
      // Silent failure - embeddings are optional enhancement
      logger.warn('Background embedding generation failed');
    } finally {
      backgroundEmbeddingGeneration = null;
    }
  })();
}

/**
 * Check if embeddings are being generated in background
 */
export function isEmbeddingGenerationInProgress(): boolean {
  return backgroundEmbeddingGeneration !== null;
}

/**
 * Wait for background embedding generation to complete (for testing)
 */
export async function waitForEmbeddingGeneration(): Promise<void> {
  if (backgroundEmbeddingGeneration) {
    await backgroundEmbeddingGeneration;
  }
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
