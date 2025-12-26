/**
 * @module lib/@docs-cache/fetcher
 * @description Context7 API integration for fetching library documentation
 *
 * Re-exports from fetcher/ submodules for backwards compatibility.
 * New code should import directly from './fetcher' or './fetcher/xxx'.
 */

export type {
  FetchDocsOptions,
  FetchDocsResult,
  FetchWithTopicsOptions,
  FetchWithTopicsResult,
} from './fetcher/index';
export {
  // Constants
  DEFAULT_MAX_PAGES,
  DEFAULT_PAGES_PER_TOPIC,
  DEFAULT_SNIPPETS_PER_PAGE,
  DEFAULT_TTL_MS,
  // Fetch functions
  fetchAndCacheDocs,
  fetchLibraryWithTopics,
  fetchProjectLibraries,
  // Parse utilities
  getLibraryDisplayName,
  // Re-exports from registry
  getTopicsForLibrary,
  // Re-export from context7-client
  hasContext7ApiKey,
  isValidLibraryId,
  parseDocsResponse,
  resolveLibraryId,
  resolveLibraryIdAsync,
  searchLibrary,
} from './fetcher/index';
