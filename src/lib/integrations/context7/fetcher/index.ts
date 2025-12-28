/**
 * @module lib/integrations/context7/fetcher
 * @description Context7 API integration for fetching library documentation
 *
 * This module provides:
 * - Library search via Context7 API
 * - Documentation fetching with pagination
 * - Multi-topic fetching for comprehensive coverage
 * - Response parsing utilities
 *
 * Split structure:
 * - constants.ts - TTL, pagination limits
 * - types.ts - FetchDocsOptions, FetchDocsResult, etc.
 * - parse.ts - Response parsing utilities
 * - fetch.ts - Core fetch and cache functions
 */

// Re-export from client for convenience
export { hasContext7ApiKey } from '../client';
// Re-export from registry for backwards compatibility
// Re-export async resolver
export {
  getTopicsForLibrary,
  resolveLibraryIdDynamic as resolveLibraryIdAsync,
  resolveLibraryIdSync as resolveLibraryId,
} from '../registry';
// Constants
export {
  DEFAULT_MAX_PAGES,
  DEFAULT_PAGES_PER_TOPIC,
  DEFAULT_SNIPPETS_PER_PAGE,
  DEFAULT_TTL_MS,
} from './constants';
// Fetch functions
export {
  fetchAndCacheDocs,
  fetchLibraryWithTopics,
  fetchProjectLibraries,
  searchLibrary,
} from './fetch';
// Parse utilities
export { getLibraryDisplayName, isValidLibraryId, parseDocsResponse } from './parse';
// Types
export type {
  FetchDocsOptions,
  FetchDocsResult,
  FetchWithTopicsOptions,
  FetchWithTopicsResult,
} from './types';
