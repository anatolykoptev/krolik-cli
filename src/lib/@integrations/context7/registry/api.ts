/**
 * @module lib/@integrations/context7/registry/api
 * @description Context7 API resolution
 *
 * This module provides:
 * - Context7 client singleton management
 * - Library ID resolution via Context7 search API
 * - Automatic caching of successful resolutions
 */

import { Context7Client, hasContext7ApiKey } from '../client';
import type { ResolutionResult } from '../types';
import { saveMappingToCache } from './database';
import { selectBestResult } from './scoring';

/** Cache singleton for Context7 client */
let clientInstance: Context7Client | null = null;

/**
 * Get or create Context7 client instance.
 */
export function getClient(): Context7Client | null {
  if (!hasContext7ApiKey()) {
    return null;
  }

  if (!clientInstance) {
    try {
      clientInstance = new Context7Client();
    } catch {
      return null;
    }
  }

  return clientInstance;
}

/**
 * Resolve library ID via Context7 search API.
 *
 * @param npmName - NPM package name
 * @param contextQuery - Optional context query for better relevance ranking (e.g., "deployment static sites")
 */
export async function resolveViaApi(
  npmName: string,
  contextQuery?: string,
): Promise<ResolutionResult | null> {
  const client = getClient();
  if (!client) {
    return null;
  }

  try {
    // Combine library name with context for better semantic ranking (like Context7 MCP)
    const searchQuery = contextQuery ? `${npmName} ${contextQuery}` : npmName;
    const response = await client.searchLibrary(searchQuery);

    if (!response.results || response.results.length === 0) {
      return null;
    }

    // Use imported selectBestResult from registry/scoring
    const best = selectBestResult(response.results, npmName);
    if (!best) {
      return null;
    }

    const context7Id = best.result.id.startsWith('/') ? best.result.id : `/${best.result.id}`;

    // Cache the successful resolution
    saveMappingToCache(
      npmName,
      context7Id,
      best.result.title,
      best.result.stars ?? 0,
      best.result.benchmarkScore ?? 0,
      false,
    );

    return {
      context7Id,
      displayName: best.result.title,
      source: 'api',
      confidence: best.score,
    };
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[Registry] API resolution failed:', error);
    }
    return null;
  }
}
