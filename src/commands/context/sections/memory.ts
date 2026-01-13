/**
 * @module commands/context/sections/memory
 * @description Memory retrieval for context
 */

import * as path from 'node:path';
import { type Memory, search as searchMemory } from '@/lib/@storage/memory';
import { MAX_MEMORIES } from '../constants';

/**
 * Load relevant memories for the current context
 */
export function loadRelevantMemory(projectRoot: string, domains: string[]): Memory[] {
  const projectName = path.basename(projectRoot);

  try {
    // First try to find memories matching features/domains
    if (domains.length > 0) {
      const domainResults = searchMemory({
        project: projectName,
        features: domains.map((d) => d.toLowerCase()),
        limit: MAX_MEMORIES,
      });

      if (domainResults.length > 0) {
        return domainResults.map((r) => r.memory);
      }
    }

    // Fallback: get recent high-importance memories
    const recentResults = searchMemory({
      project: projectName,
      importance: 'high',
      limit: MAX_MEMORIES,
    });

    if (recentResults.length > 0) {
      return recentResults.map((r) => r.memory);
    }

    // Final fallback: any recent memories
    const anyResults = searchMemory({
      project: projectName,
      limit: MAX_MEMORIES,
    });

    return anyResults.map((r) => r.memory);
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[context] Memory search failed:', error);
    }
    return [];
  }
}
