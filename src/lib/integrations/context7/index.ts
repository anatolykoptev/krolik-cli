/**
 * @module lib/integrations/context7
 * @description Context7 integration for library documentation
 *
 * This module provides:
 * - HTTP client for Context7 API
 * - Library ID resolution with caching
 * - Documentation fetching with multi-topic support
 * - Project library detection
 *
 * @example
 * ```ts
 * import { detectLibraries, fetchAndCacheDocs, Context7Client } from '@/lib/integrations/context7';
 *
 * // Detect project libraries
 * const detected = detectLibraries('/path/to/project');
 *
 * // Fetch docs for a library
 * await fetchAndCacheDocs('next.js');
 *
 * // Direct API access
 * const client = createContext7Client();
 * const results = await client.searchLibrary('react');
 * ```
 */

// Types from client
export type {
  CodeDocsResponse,
  CodeExample,
  CodeSnippet,
  GetDocsOptions,
  InfoDocsResponse,
  InfoSnippet,
  Pagination,
} from './client';
// Client
export {
  Context7Client,
  type Context7Config,
  createContext7Client,
  hasContext7ApiKey,
  type SearchLibraryResponse,
  type SearchResult,
} from './client';
// Detector
export { detectLibraries, getSuggestions, getSupportedLibraries } from './detector';
// Fetcher
export {
  DEFAULT_MAX_PAGES,
  DEFAULT_PAGES_PER_TOPIC,
  DEFAULT_SNIPPETS_PER_PAGE,
  DEFAULT_TTL_MS,
  type FetchDocsOptions,
  type FetchDocsResult,
  type FetchWithTopicsOptions,
  type FetchWithTopicsResult,
  fetchAndCacheDocs,
  fetchLibraryWithTopics,
  fetchProjectLibraries,
  getLibraryDisplayName,
  getTopicsForLibrary,
  isValidLibraryId,
  parseDocsResponse,
  resolveLibraryId,
  resolveLibraryIdAsync,
  searchLibrary,
} from './fetcher';
// Registry
export {
  addTopicsForLibrary,
  clearRegistry,
  DEFAULT_MAPPINGS,
  DEFAULT_TOPICS,
  ensureRegistryTables,
  getAllMappings,
  getCachedMapping,
  getCachedTopics,
  getClient,
  getRegistryStats,
  getUniqueLibraryIds,
  initializeRegistry,
  MIN_CONFIDENCE_THRESHOLD,
  MIN_SNIPPETS_FOR_BONUS,
  MIN_STARS_FOR_BONUS,
  recordTopicUsage,
  registerMapping,
  resolveLibraryIdDynamic,
  resolveLibraryIdSync,
  resolveViaApi,
  SCORING_WEIGHTS,
  saveMappingToCache,
  saveTopicToCache,
  scoreSearchResult,
  seedDefaultMappings,
  seedDefaultTopics,
  selectBestResult,
} from './registry';

// Types from types.ts
export type {
  CachedLibrary,
  DetectedLibrary,
  DocSearchResult,
  DocSection,
  DocsCacheStats,
  DocsFetchOptions,
  DocsSearchOptions,
  LibraryMapping,
  LibraryTopic,
  RegistryStats,
  ResolutionResult,
  ResolutionSource,
} from './types';
