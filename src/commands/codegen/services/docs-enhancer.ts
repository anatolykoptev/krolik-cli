/**
 * @module commands/codegen/services/docs-enhancer
 * @description Service that enhances code generation with cached documentation
 */

import type { DocSearchResult } from '@/lib/@docs-cache';
import { searchDocs } from '@/lib/@docs-cache';
import { extractImports, extractPatterns, extractSnippets } from './snippet-extractor';
import type { DocHints, SearchStrategy } from './types';
import { emptyHints } from './types';

/**
 * Search strategies per generator type
 */
const STRATEGIES: Record<string, SearchStrategy> = {
  'trpc-route': {
    queries: ['trpc router', 'procedure mutation', 'protectedProcedure'],
    preferredLibraries: ['trpc', '@trpc/server'],
    maxSnippets: 5,
  },
  'zod-schema': {
    queries: ['zod schema', 'z.object validation', 'zod refine'],
    preferredLibraries: ['zod'],
    maxSnippets: 5,
  },
  test: {
    queries: ['vitest describe', 'testing-library render', 'expect toBe'],
    preferredLibraries: ['vitest', '@testing-library/react'],
    maxSnippets: 5,
  },
};

/** Session cache to avoid repeated searches */
const sessionCache = new Map<string, DocHints>();

/**
 * Clear session cache (call at end of codegen command)
 */
export function clearEnhancerCache(): void {
  sessionCache.clear();
}

/**
 * DocsEnhancer interface for dependency injection
 */
export interface IDocsEnhancer {
  getHints(generatorId: string, options: { name: string }): DocHints;
}

/**
 * Default DocsEnhancer implementation using FTS5 search
 */
export class DocsEnhancer implements IDocsEnhancer {
  /**
   * Get enhancement hints for a generator
   */
  getHints(generatorId: string, options: { name: string }): DocHints {
    const cacheKey = `${generatorId}:${options.name}`;

    // Check session cache
    if (sessionCache.has(cacheKey)) {
      return sessionCache.get(cacheKey)!;
    }

    const strategy = STRATEGIES[generatorId];
    if (!strategy) {
      return emptyHints();
    }

    try {
      const hints = this.searchAndProcess(strategy);
      sessionCache.set(cacheKey, hints);
      return hints;
    } catch {
      // Database not initialized or search failed
      return emptyHints();
    }
  }

  /**
   * Execute searches and process results
   */
  private searchAndProcess(strategy: SearchStrategy): DocHints {
    const allResults: DocSearchResult[] = [];

    // Execute each query
    for (const query of strategy.queries) {
      try {
        const results = searchDocs({
          query,
          library: strategy.preferredLibraries?.[0],
          limit: strategy.maxSnippets,
        });
        allResults.push(...results);
      } catch {
        // Individual query failed, continue with others
      }
    }

    if (allResults.length === 0) {
      return emptyHints();
    }

    // Deduplicate by section id
    const seen = new Set<number>();
    const uniqueResults = allResults.filter((r) => {
      if (seen.has(r.section.id)) return false;
      seen.add(r.section.id);
      return true;
    });

    // Extract components
    const snippets = extractSnippets(uniqueResults, strategy.maxSnippets);
    const imports = extractImports(snippets);
    const patterns = extractPatterns(snippets);
    const sources = [...new Set(uniqueResults.map((r) => r.libraryName))];

    return {
      snippets,
      imports,
      patterns,
      sources,
      enhanced: snippets.length > 0,
    };
  }
}

/** Default enhancer instance */
export const docsEnhancer = new DocsEnhancer();
