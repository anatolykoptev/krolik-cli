/**
 * @module lib/@integrations/context7/fetcher/fetch
 * @description Core fetching and caching functions
 *
 * This module provides functions for:
 * - Searching libraries via Context7 API
 * - Fetching and caching documentation
 * - Multi-topic fetching for better coverage
 * - Project-wide library fetching
 */

import {
  type CodeSnippet,
  Context7Client,
  type GetDocsOptions,
  hasContext7ApiKey,
  type SearchResult,
} from '../client';
// Use factory to access storage (proper layer separation)
import { getDefaultRepository } from '../factory';
import {
  getTopicsForLibrary,
  initializeRegistry,
  recordTopicUsage,
  resolveLibraryIdDynamic,
} from '../registry';
import { DEFAULT_MAX_PAGES, DEFAULT_PAGES_PER_TOPIC } from './constants';
import { getLibraryDisplayName } from './parse';
import type {
  FetchDocsOptions,
  FetchDocsResult,
  FetchWithTopicsOptions,
  FetchWithTopicsResult,
} from './types';

/**
 * Search for a library using Context7 API
 */
export async function searchLibrary(query: string): Promise<SearchResult[]> {
  if (!hasContext7ApiKey()) {
    throw new Error('CONTEXT7_API_KEY not set');
  }

  const client = new Context7Client();
  const response = await client.searchLibrary(query);
  return response.results;
}

/**
 * Fetch documentation from Context7 and cache it.
 *
 * Uses dynamic library resolution with API fallback for unknown libraries.
 * Records topic usage for learning.
 */
export async function fetchAndCacheDocs(
  libraryName: string,
  options: FetchDocsOptions = {},
): Promise<FetchDocsResult> {
  const { topic, mode = 'code', maxPages = DEFAULT_MAX_PAGES, force = false } = options;

  // Initialize registry on first use
  initializeRegistry();

  // Resolve library ID dynamically (with API fallback)
  const resolution = await resolveLibraryIdDynamic(libraryName);

  if (!resolution) {
    throw new Error(`Library not found: ${libraryName}. Try a different name or Context7 ID.`);
  }

  const libraryId = resolution.context7Id;

  // Check if already cached and not expired
  const repository = getDefaultRepository();
  if (!force) {
    const cached = repository.getLibrary(libraryId);
    if (cached && !cached.isExpired) {
      return {
        libraryId,
        libraryName: cached.name,
        sectionsAdded: 0,
        totalSnippets: cached.totalSnippets,
        fromCache: true,
        pages: 0,
      };
    }
  }

  if (!hasContext7ApiKey()) {
    throw new Error('CONTEXT7_API_KEY not set');
  }

  const client = new Context7Client();
  const displayName = getLibraryDisplayName(libraryId);

  // Save library entry first
  repository.saveLibrary(libraryId, displayName);

  let sectionsAdded = 0;
  let totalSnippets = 0;
  let currentPage = 1;
  let hasMore = true;

  // Fetch pages (API limit is 10 items per page)
  while (hasMore && currentPage <= maxPages) {
    const docsOptions: GetDocsOptions = {
      mode,
      page: currentPage,
      limit: 10,
    };

    if (topic) {
      docsOptions.topic = topic;
    }

    const response = await client.getDocs(libraryId, docsOptions);

    // Process snippets (code mode)
    if ('snippets' in response && Array.isArray(response.snippets)) {
      for (const snippet of response.snippets as CodeSnippet[]) {
        const codeSnippets = snippet.codeList?.map((c) => c.code) || [];

        repository.saveSection(
          libraryId,
          topic,
          snippet.codeTitle || snippet.pageTitle,
          snippet.codeDescription,
          codeSnippets,
          currentPage,
        );

        sectionsAdded++;
        totalSnippets += codeSnippets.length;
      }
    }

    hasMore = response.pagination?.hasNext ?? false;
    currentPage++;
  }

  // Record topic usage for learning (if topic was specified and successful)
  if (topic && sectionsAdded > 0) {
    recordTopicUsage(libraryId, topic);
  }

  return {
    libraryId,
    libraryName: displayName,
    sectionsAdded,
    totalSnippets,
    fromCache: false,
    pages: currentPage - 1,
  };
}

/**
 * Fetch library documentation with multiple topics for better coverage.
 *
 * This function fetches documentation for several topics sequentially,
 * providing much better coverage than a single generic fetch.
 * Uses dynamic resolution and learns from topic usage patterns.
 *
 * @param libraryName - Library name or Context7 ID
 * @param options - Fetch options including topics to fetch
 */
export async function fetchLibraryWithTopics(
  libraryName: string,
  options: FetchWithTopicsOptions = {},
): Promise<FetchWithTopicsResult> {
  const {
    topics: customTopics,
    usePreferredTopics = true,
    mode = 'code',
    pagesPerTopic = DEFAULT_PAGES_PER_TOPIC,
    force = false,
  } = options;

  // Initialize registry
  initializeRegistry();

  // Resolve library ID dynamically (with API fallback)
  const resolution = await resolveLibraryIdDynamic(libraryName);

  if (!resolution) {
    throw new Error(`Library not found: ${libraryName}. Try a different name or Context7 ID.`);
  }

  const libraryId = resolution.context7Id;

  // Determine topics to fetch
  let topics: string[] = [];

  if (customTopics && customTopics.length > 0) {
    topics = customTopics;
  } else if (usePreferredTopics) {
    topics = getTopicsForLibrary(libraryId);
  }

  // If no topics defined, do a general fetch with more pages
  if (topics.length === 0) {
    const result = await fetchAndCacheDocs(libraryName, {
      mode,
      maxPages: DEFAULT_MAX_PAGES,
      force,
    });

    return {
      libraryId: result.libraryId,
      libraryName: result.libraryName,
      topics: [],
      totalSections: result.sectionsAdded,
      totalSnippets: result.totalSnippets,
      fromCache: result.fromCache,
    };
  }

  // Fetch each topic
  let totalSections = 0;
  let totalSnippets = 0;
  let anyFromCache = false;

  for (const topic of topics) {
    try {
      const result = await fetchAndCacheDocs(libraryName, {
        topic,
        mode,
        maxPages: pagesPerTopic,
        force,
      });

      totalSections += result.sectionsAdded;
      totalSnippets += result.totalSnippets;
      if (result.fromCache) anyFromCache = true;
    } catch (error) {
      // Log but continue with other topics
      if (process.env.DEBUG) {
        console.error(`[fetcher] Failed to fetch topic "${topic}" for ${libraryName}:`, error);
      }
    }
  }

  return {
    libraryId,
    libraryName: getLibraryDisplayName(libraryId),
    topics,
    totalSections,
    totalSnippets,
    fromCache: anyFromCache && totalSections === 0,
  };
}

/**
 * Fetch all project libraries with their preferred topics
 *
 * @param libraries - Array of library names to fetch
 * @param options - Fetch options
 */
export async function fetchProjectLibraries(
  libraries: string[],
  options: Omit<FetchWithTopicsOptions, 'topics'> = {},
): Promise<FetchWithTopicsResult[]> {
  const results: FetchWithTopicsResult[] = [];

  for (const lib of libraries) {
    try {
      const result = await fetchLibraryWithTopics(lib, {
        ...options,
        usePreferredTopics: true,
      });
      results.push(result);
    } catch (error) {
      if (process.env.DEBUG) {
        console.error(`[fetcher] Failed to fetch library ${lib}:`, error);
      }
    }
  }

  return results;
}
