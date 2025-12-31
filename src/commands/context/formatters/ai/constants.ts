/**
 * @module commands/context/formatters/ai/constants
 * @description Constants for AI XML formatter output limits
 *
 * Imports shared constants from @output-optimizer where applicable.
 * Local constants are kept for values specific to this formatter.
 *
 * Token Budget Optimization by Mode:
 * | Mode  | Max Files | Sigs/File | Routes    | Schema    |
 * |-------|-----------|-----------|-----------|-----------|
 * | quick | 30        | 5         | summary   | summary   |
 * | deep  | 40        | 8         | top 5     | top 4     |
 * | full  | 50        | 15        | top 10    | top 8     |
 */

import { MAX_INLINE_LIST_ITEMS, MAX_MEMORY_ITEMS, MAX_PATH_LENGTH } from '@/lib/@format';
import type { ContextMode } from '../../types';

// Re-export optimizer constants for convenience
export { MAX_INLINE_LIST_ITEMS, MAX_MEMORY_ITEMS, MAX_PATH_LENGTH };

// Limit constants for output formatting
export const MAX_LIMIT = 6;
export const MAX_ITEMS_SMALL = 3;
/** Uses MAX_INLINE_LIST_ITEMS from @output-optimizer */
export const MAX_ITEMS_MEDIUM = MAX_INLINE_LIST_ITEMS; // 5
export const MAX_ITEMS_LARGE = 10;
export const MAX_SIZE = 15;
export const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// MODE-BASED TOKEN BUDGET LIMITS
// ============================================================================

/**
 * Mode-based limits for repo-map (smart context)
 */
export interface RepoMapLimits {
  maxFiles: number;
  maxSignaturesPerFile: number;
}

/**
 * Mode-based limits for routes section
 */
export interface RoutesLimits {
  /** Use summary only (no full details) */
  summaryOnly: boolean;
  /** Max routers in summary */
  summaryLimit: number;
  /** Max routers in full output */
  fullLimit: number;
}

/**
 * Mode-based limits for schema section
 */
export interface SchemaLimits {
  /** Use highlights only (no full details) */
  highlightsOnly: boolean;
  /** Max models in highlights */
  highlightsLimit: number;
  /** Max models in full output */
  fullLimit: number;
}

/**
 * Combined mode-based limits
 */
export interface ModeLimits {
  repoMap: RepoMapLimits;
  routes: RoutesLimits;
  schema: SchemaLimits;
}

/**
 * Token budget limits by context mode
 *
 * Optimization strategy:
 * - quick: Summaries only, minimal files (~3500 tokens)
 * - deep: Limited full sections for heavy analysis
 * - full: All details with both summaries and full sections
 */
export const MODE_LIMITS: Record<ContextMode, ModeLimits> = {
  minimal: {
    repoMap: { maxFiles: 20, maxSignaturesPerFile: 3 },
    routes: { summaryOnly: true, summaryLimit: 5, fullLimit: 0 },
    schema: { highlightsOnly: true, highlightsLimit: 5, fullLimit: 0 },
  },
  quick: {
    repoMap: { maxFiles: 30, maxSignaturesPerFile: 5 },
    routes: { summaryOnly: true, summaryLimit: 10, fullLimit: 0 },
    schema: { highlightsOnly: true, highlightsLimit: 8, fullLimit: 0 },
  },
  deep: {
    repoMap: { maxFiles: 40, maxSignaturesPerFile: 8 },
    routes: { summaryOnly: false, summaryLimit: 0, fullLimit: 5 },
    schema: { highlightsOnly: false, highlightsLimit: 0, fullLimit: 4 },
  },
  full: {
    repoMap: { maxFiles: 50, maxSignaturesPerFile: 15 },
    routes: { summaryOnly: false, summaryLimit: 10, fullLimit: 10 },
    schema: { highlightsOnly: false, highlightsLimit: 8, fullLimit: 8 },
  },
};

/**
 * Get mode-specific limits
 */
export function getModeLimits(mode: ContextMode): ModeLimits {
  return MODE_LIMITS[mode];
}
