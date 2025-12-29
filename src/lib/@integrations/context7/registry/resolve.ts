/**
 * @module lib/@integrations/context7/registry/resolve
 * @description Library ID resolution functions
 *
 * This module provides:
 * - Async resolution with API fallback
 * - Sync resolution for fast checks (cache + defaults only)
 * - Manual mapping registration
 */

import type { ResolutionResult } from '../types';
import { resolveViaApi } from './api';
import { getCachedMapping, saveMappingToCache } from './database';
import { DEFAULT_MAPPINGS } from './defaults';

/**
 * Resolve npm package name to Context7 library ID (async).
 *
 * Resolution order:
 * 1. Check SQLite cache
 * 2. Check if already a Context7 ID format
 * 3. Try Context7 search API
 * 4. Return null if not found
 *
 * @param npmName - NPM package name (e.g., 'next', '@prisma/client')
 * @returns Resolution result with source and confidence, or null
 */
export async function resolveLibraryIdDynamic(npmName: string): Promise<ResolutionResult | null> {
  const normalized = npmName.toLowerCase().trim();

  // 1. Check cache first (fast path)
  const cached = getCachedMapping(normalized);
  if (cached) {
    return {
      context7Id: cached.context7Id,
      displayName: cached.displayName,
      source: 'cache',
      confidence: 1,
    };
  }

  // 2. Check if already Context7 ID format (/owner/repo)
  if (normalized.startsWith('/') && normalized.split('/').length >= 3) {
    const parts = normalized.split('/').filter(Boolean);
    const displayName = parts[parts.length - 1] || 'Unknown';

    saveMappingToCache(normalized, normalized, displayName, 0, 0, false);

    return {
      context7Id: normalized,
      displayName,
      source: 'cache',
      confidence: 1,
    };
  }

  // 3. Try Context7 API
  const apiResult = await resolveViaApi(normalized);
  if (apiResult) {
    return apiResult;
  }

  return null;
}

/**
 * Synchronous version that only checks cache and defaults.
 * Use this when async is not available or for fast checks.
 *
 * @param npmName - NPM package name
 * @returns Context7 ID or null
 */
export function resolveLibraryIdSync(npmName: string): string | null {
  const normalized = npmName.toLowerCase().trim();

  // Check cache
  const cached = getCachedMapping(normalized);
  if (cached) {
    return cached.context7Id;
  }

  // Check if already Context7 ID
  if (normalized.startsWith('/') && normalized.split('/').length >= 3) {
    return normalized;
  }

  // Check defaults
  for (const mapping of DEFAULT_MAPPINGS) {
    if (
      mapping.patterns.some(
        (p) => normalized === p.toLowerCase() || normalized.startsWith(p.toLowerCase()),
      )
    ) {
      return mapping.context7Id;
    }
  }

  return null;
}

/**
 * Manually register a library mapping.
 */
export function registerMapping(npmName: string, context7Id: string, displayName: string): void {
  saveMappingToCache(npmName, context7Id, displayName, 0, 0, true);
}
