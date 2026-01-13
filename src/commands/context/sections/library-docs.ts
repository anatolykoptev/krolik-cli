/**
 * @module commands/context/sections/library-docs
 * @description Library documentation loading from Context7
 */

import {
  detectLibraries,
  fetchAndCacheDocs,
  getSuggestions,
  hasContext7ApiKey,
} from '@/lib/@integrations/context7';
import { getSectionsByLibrary, searchDocs } from '@/lib/@storage/docs';
import type { LibraryDocsEntry } from '../types';

/**
 * Load library documentation from Context7 cache (with auto-fetch)
 * Auto-fetches missing/expired libraries if CONTEXT7_API_KEY is set
 */
export async function loadLibraryDocs(
  projectRoot: string,
  domains: string[],
): Promise<LibraryDocsEntry[]> {
  const results: LibraryDocsEntry[] = [];

  try {
    // Detect libraries from package.json
    const detected = detectLibraries(projectRoot);
    if (detected.length === 0) return [];

    const suggestions = getSuggestions(detected);
    const apiAvailable = hasContext7ApiKey();

    // Auto-fetch missing libraries if API key is available
    if (apiAvailable && suggestions.toFetch.length > 0) {
      for (const libName of suggestions.toFetch.slice(0, 3)) {
        try {
          await fetchAndCacheDocs(libName, { maxPages: 2 });
        } catch (error) {
          if (process.env.DEBUG) {
            console.error('[context] Library docs fetch failed:', error);
          }
        }
      }
    }

    // Auto-refresh expired libraries (limit to 2)
    if (apiAvailable && suggestions.toRefresh.length > 0) {
      for (const libName of suggestions.toRefresh.slice(0, 2)) {
        try {
          await fetchAndCacheDocs(libName, { force: true, maxPages: 2 });
        } catch (error) {
          if (process.env.DEBUG) {
            console.error('[context] Library docs refresh failed:', error);
          }
        }
      }
    }

    // Build search query from domains
    const searchQuery = domains
      .filter((d) => !['general', 'development', 'context'].includes(d.toLowerCase()))
      .join(' ')
      .trim();

    // Search for relevant docs for each cached library
    for (const lib of detected) {
      if (!lib.context7Id) continue;

      let searchResults =
        searchQuery.length > 0
          ? searchDocs({ query: searchQuery, library: lib.name, limit: 3 })
          : [];

      // Fallback to general sections if domain search found nothing
      if (searchResults.length === 0 && lib.isCached && lib.context7Id) {
        const sections = getSectionsByLibrary(lib.context7Id);
        searchResults = sections.slice(0, 3).map((section) => ({
          section,
          libraryName: lib.name,
          relevance: 0.5,
        }));
      }

      if (searchResults.length === 0 && !lib.isCached) {
        results.push({
          libraryName: lib.name,
          libraryId: lib.context7Id,
          status: 'unavailable',
          sections: [],
        });
        continue;
      }

      if (searchResults.length > 0) {
        results.push({
          libraryName: lib.name,
          libraryId: lib.context7Id,
          status: lib.isExpired ? 'expired' : 'cached',
          sections: searchResults.map((r) => ({
            title: r.section.title,
            content: r.section.content.slice(0, 500),
            codeSnippets: r.section.codeSnippets.slice(0, 2),
          })),
        });
      } else if (lib.isCached) {
        results.push({
          libraryName: lib.name,
          libraryId: lib.context7Id,
          status: 'cached',
          sections: [],
        });
      }
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[context] Library docs loading failed:', error);
    }
    return [];
  }

  return results;
}
