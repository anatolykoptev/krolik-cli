/**
 * @module lib/@context/memory
 * @description Shared memory search and enrichment logic
 */

import path from 'node:path';
import { logger } from '@/lib/@core/logger/logger';
import type { Memory, SmartSearchResult } from '@/lib/@storage/memory';
import { getCriticalMemories, getRecentDecisions, smartSearch } from '@/lib/@storage/memory';

export const MEMORY_LIMITS = {
  SEARCH: 5,
  CRITICAL: 3,
  RECENT: 3,
  TOTAL: 10,
};

/**
 * Load relevant memories using smart ranking
 */
export function loadContextMemories(
  projectRoot: string,
  query?: string,
  feature?: string,
  limit: number = MEMORY_LIMITS.TOTAL,
): Memory[] {
  try {
    const projectName = path.basename(projectRoot);

    // If we have a specific query/feature, use smart search
    if (query || feature) {
      const results = smartSearch({
        project: projectName,
        query: query,
        currentFeature: feature,
        minRelevance: 0.6, // Default relevance threshold
        limit: limit * 2, // Fetch more candidates for deduplication
      });

      if (results.length > 0) {
        logger.debug(`[context] Loaded ${results.length} memories via smart search`);
        return deduplicateMemories(results.slice(0, limit));
      }
    }

    // Fallback: Critical + Recent Decisions
    const critical = getCriticalMemories(projectName, MEMORY_LIMITS.CRITICAL);
    const decisions = getRecentDecisions(projectName, feature, MEMORY_LIMITS.RECENT);

    const combined = [...critical, ...decisions];
    const unique = deduplicateMemories(combined);

    logger.debug(`[context] Fallback memories: ${unique.length}`);
    return unique.slice(0, limit);
  } catch (error) {
    logger.debug(
      `[context] Memory loading failed: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    return [];
  }
}

/**
 * Deduplicate memories by ID
 */
function deduplicateMemories(items: (Memory | SmartSearchResult)[]): Memory[] {
  const seen = new Set<string>();
  const unique: Memory[] = [];

  for (const item of items) {
    const memory = 'memory' in item ? item.memory : item;
    if (!seen.has(memory.id)) {
      seen.add(memory.id);
      unique.push(memory);
    }
  }

  return unique;
}
