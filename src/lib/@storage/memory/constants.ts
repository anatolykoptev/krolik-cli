/**
 * @module lib/@storage/memory/constants
 * @description Storage constants and default values
 */

/** Default importance level for new memories */
export const DEFAULT_IMPORTANCE = 'medium' as const;

/** Default limit for search results */
export const DEFAULT_SEARCH_LIMIT = 10;

/** Default relevance score for LIKE-based search matches */
export const LIKE_MATCH_RELEVANCE = 50;

/** Default relevance score for feature-based fallback search */
export const FEATURE_FALLBACK_RELEVANCE = 30;

/** High importance levels for context injection queries */
export const HIGH_IMPORTANCE_LEVELS = ['high', 'critical'] as const;

/** Multiplier for converting BM25 rank to relevance score */
export const BM25_RELEVANCE_MULTIPLIER = 100;
