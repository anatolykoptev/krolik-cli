/**
 * @module commands/docs
 * @description Documentation cache command handlers
 */

import {
  clearExpired,
  deleteLibrary,
  detectLibraries,
  fetchAndCacheDocs,
  fetchLibraryWithTopics,
  getLibraryByName,
  getSuggestions,
  hasContext7ApiKey,
  listLibraries,
  resolveLibraryId,
  searchDocs,
} from '../../lib/@docs-cache';
import type { CommandContext, OutputFormat } from '../../types';

interface DocsFetchOptions {
  library: string;
  topic?: string;
  topics?: string[];
  withTopics?: boolean;
  mode?: 'code' | 'info';
  force?: boolean;
  maxPages?: number;
  pagesPerTopic?: number;
  format?: OutputFormat;
}

interface DocsSearchOptions {
  query: string;
  library?: string;
  topic?: string;
  limit?: number;
  format?: OutputFormat;
}

interface DocsListOptions {
  expired?: boolean;
  format?: OutputFormat;
}

interface DocsDetectOptions {
  format?: OutputFormat;
}

interface DocsClearOptions {
  library?: string;
  expired?: boolean;
  format?: OutputFormat;
}

/**
 * Fetch documentation for a library
 * Uses Context7 API directly if CONTEXT7_API_KEY is set
 */
export async function runDocsFetch(
  ctx: CommandContext & { options: DocsFetchOptions },
): Promise<void> {
  const { options } = ctx;
  const format = options.format ?? 'ai';
  const libraryName = options.library;

  // Check if API key is available
  if (!hasContext7ApiKey()) {
    // Fall back to instructions for MCP
    const libraryId = resolveLibraryId(libraryName);
    const context7Id =
      libraryId ?? `Use mcp__context7__resolve-library-id to resolve "${libraryName}"`;

    if (format === 'json') {
      console.log(
        JSON.stringify(
          {
            status: 'no_api_key',
            library: libraryName,
            libraryId: context7Id,
            message: 'Set CONTEXT7_API_KEY to enable direct fetching, or use MCP tools',
            mcp_steps: [
              libraryId
                ? null
                : `mcp__context7__resolve-library-id({ libraryName: "${libraryName}" })`,
              `mcp__context7__get-library-docs({ context7CompatibleLibraryID: "${libraryId ?? 'resolved_id'}" })`,
            ].filter(Boolean),
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`<docs-fetch library="${libraryName}" status="no_api_key">
  <message>Set CONTEXT7_API_KEY environment variable to enable direct fetching</message>
  <context7-id>${context7Id}</context7-id>
  <mcp-fallback>
    ${libraryId ? '' : `1. mcp__context7__resolve-library-id({ libraryName: "${libraryName}" })`}
    ${libraryId ? '1' : '2'}. mcp__context7__get-library-docs({ context7CompatibleLibraryID: "${libraryId ?? 'resolved_id'}" })
  </mcp-fallback>
</docs-fetch>`);
    return;
  }

  // Direct API fetch
  try {
    // Use multi-topic fetching if --with-topics or --topics is specified
    if (options.withTopics || (options.topics && options.topics.length > 0)) {
      const result = await fetchLibraryWithTopics(libraryName, {
        topics: options.topics,
        usePreferredTopics: options.withTopics ?? true,
        mode: options.mode,
        pagesPerTopic: options.pagesPerTopic,
        force: options.force,
      });

      if (result.fromCache) {
        if (format === 'json') {
          console.log(
            JSON.stringify(
              {
                status: 'cached',
                library: result.libraryName,
                libraryId: result.libraryId,
                topics: result.topics,
                totalSnippets: result.totalSnippets,
                message: 'Documentation already cached. Use --force to refresh.',
              },
              null,
              2,
            ),
          );
          return;
        }

        console.log(`<docs-fetch library="${result.libraryName}" status="cached" mode="multi-topic">
  <library-id>${result.libraryId}</library-id>
  <topics>${result.topics.join(', ') || 'general'}</topics>
  <total-snippets>${result.totalSnippets}</total-snippets>
  <message>Already cached. Use --force to refresh.</message>
</docs-fetch>`);
        return;
      }

      if (format === 'json') {
        console.log(
          JSON.stringify(
            {
              status: 'fetched',
              library: result.libraryName,
              libraryId: result.libraryId,
              topics: result.topics,
              sectionsAdded: result.totalSections,
              totalSnippets: result.totalSnippets,
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(`<docs-fetch library="${result.libraryName}" status="fetched" mode="multi-topic">
  <library-id>${result.libraryId}</library-id>
  <topics>${result.topics.join(', ') || 'general'}</topics>
  <sections-added>${result.totalSections}</sections-added>
  <total-snippets>${result.totalSnippets}</total-snippets>
</docs-fetch>`);
      return;
    }

    // Single topic or general fetch
    const result = await fetchAndCacheDocs(libraryName, {
      topic: options.topic,
      mode: options.mode,
      maxPages: options.maxPages,
      force: options.force,
    });

    if (result.fromCache) {
      if (format === 'json') {
        console.log(
          JSON.stringify(
            {
              status: 'cached',
              library: result.libraryName,
              libraryId: result.libraryId,
              totalSnippets: result.totalSnippets,
              message: 'Documentation already cached. Use --force to refresh.',
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(`<docs-fetch library="${result.libraryName}" status="cached">
  <library-id>${result.libraryId}</library-id>
  <total-snippets>${result.totalSnippets}</total-snippets>
  <message>Already cached. Use --force to refresh.</message>
</docs-fetch>`);
      return;
    }

    if (format === 'json') {
      console.log(
        JSON.stringify(
          {
            status: 'fetched',
            library: result.libraryName,
            libraryId: result.libraryId,
            sectionsAdded: result.sectionsAdded,
            totalSnippets: result.totalSnippets,
            pages: result.pages,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`<docs-fetch library="${result.libraryName}" status="fetched">
  <library-id>${result.libraryId}</library-id>
  <sections-added>${result.sectionsAdded}</sections-added>
  <total-snippets>${result.totalSnippets}</total-snippets>
  <pages-fetched>${result.pages}</pages-fetched>
</docs-fetch>`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (format === 'json') {
      console.log(
        JSON.stringify(
          {
            status: 'error',
            library: libraryName,
            error: message,
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`<docs-fetch library="${libraryName}" status="error">
  <error>${message}</error>
</docs-fetch>`);
  }
}

/**
 * Search cached documentation
 */
export async function runDocsSearch(
  ctx: CommandContext & { options: DocsSearchOptions },
): Promise<void> {
  const { options } = ctx;
  const format = options.format ?? 'ai';

  try {
    const results = searchDocs({
      query: options.query,
      library: options.library,
      topic: options.topic,
      limit: options.limit ?? 10,
    });

    if (results.length === 0) {
      if (format === 'json') {
        console.log(
          JSON.stringify(
            {
              query: options.query,
              results: [],
              count: 0,
              message: 'No matching documentation found. Try fetching more libraries.',
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(`<docs-search query="${options.query}" count="0">
  <message>No matching documentation found</message>
  <suggestion>Run "krolik docs detect" to see available libraries</suggestion>
  <suggestion>Run "krolik docs fetch next.js" to cache documentation</suggestion>
</docs-search>`);
      return;
    }

    if (format === 'json') {
      console.log(
        JSON.stringify(
          {
            query: options.query,
            count: results.length,
            results: results.map((r) => ({
              libraryName: r.libraryName,
              title: r.section.title,
              topic: r.section.topic,
              relevance: r.relevance,
              content:
                r.section.content.slice(0, 500) + (r.section.content.length > 500 ? '...' : ''),
              codeSnippets: r.section.codeSnippets.length,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    const lines = [`<docs-search query="${options.query}" count="${results.length}">`];
    for (const r of results) {
      lines.push(`  <result library="${r.libraryName}" relevance="${r.relevance.toFixed(2)}">`);
      lines.push(`    <title>${r.section.title}</title>`);
      if (r.section.topic) lines.push(`    <topic>${r.section.topic}</topic>`);
      lines.push(
        `    <content>${r.section.content.slice(0, 300)}${r.section.content.length > 300 ? '...' : ''}</content>`,
      );
      if (r.section.codeSnippets.length > 0) {
        const firstSnippet = r.section.codeSnippets[0]!;
        lines.push(`    <code-snippets count="${r.section.codeSnippets.length}">`);
        lines.push(`      ${firstSnippet.slice(0, 200)}${firstSnippet.length > 200 ? '...' : ''}`);
        lines.push(`    </code-snippets>`);
      }
      lines.push(`  </result>`);
    }
    lines.push(`</docs-search>`);
    console.log(lines.join('\n'));
  } catch (_error) {
    // Tables might not exist yet (first run)
    if (format === 'json') {
      console.log(
        JSON.stringify(
          {
            query: options.query,
            results: [],
            count: 0,
            message: 'No cached documentation. Use "krolik docs fetch" first.',
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`<docs-search query="${options.query}" count="0">
  <message>No cached documentation found</message>
  <suggestion>Run "krolik docs fetch next.js" to cache documentation</suggestion>
</docs-search>`);
  }
}

/**
 * List cached libraries
 */
export async function runDocsList(
  ctx: CommandContext & { options: DocsListOptions },
): Promise<void> {
  const { options } = ctx;
  const format = options.format ?? 'ai';

  try {
    let libraries = listLibraries();

    if (options.expired) {
      libraries = libraries.filter((lib) => lib.isExpired);
    }

    if (libraries.length === 0) {
      if (format === 'json') {
        console.log(JSON.stringify({ libraries: [], count: 0 }, null, 2));
        return;
      }

      console.log(`<docs-cache count="0">
  <message>No libraries cached yet</message>
  <suggestion>Run "krolik docs fetch next.js" to get started</suggestion>
</docs-cache>`);
      return;
    }

    if (format === 'json') {
      console.log(
        JSON.stringify(
          {
            count: libraries.length,
            libraries: libraries.map((lib) => ({
              name: lib.name,
              libraryId: lib.libraryId,
              version: lib.version,
              fetchedAt: lib.fetchedAt,
              expiresAt: lib.expiresAt,
              totalSnippets: lib.totalSnippets,
              isExpired: lib.isExpired,
            })),
          },
          null,
          2,
        ),
      );
      return;
    }

    const lines = [`<docs-cache count="${libraries.length}">`];
    for (const lib of libraries) {
      const status = lib.isExpired ? 'expired' : 'valid';
      lines.push(`  <library name="${lib.name}" status="${status}">`);
      lines.push(`    <id>${lib.libraryId}</id>`);
      if (lib.version) lines.push(`    <version>${lib.version}</version>`);
      lines.push(`    <fetched>${lib.fetchedAt}</fetched>`);
      lines.push(`    <expires>${lib.expiresAt}</expires>`);
      lines.push(`    <snippets>${lib.totalSnippets}</snippets>`);
      lines.push(`  </library>`);
    }
    lines.push(`</docs-cache>`);
    console.log(lines.join('\n'));
  } catch {
    // Tables might not exist yet
    if (format === 'json') {
      console.log(JSON.stringify({ libraries: [], count: 0 }, null, 2));
      return;
    }

    console.log(`<docs-cache count="0">
  <message>No libraries cached yet</message>
  <suggestion>Run "krolik docs fetch next.js" to get started</suggestion>
</docs-cache>`);
  }
}

/**
 * Detect libraries from package.json
 */
export async function runDocsDetect(
  ctx: CommandContext & { options: DocsDetectOptions },
): Promise<void> {
  const { config, options } = ctx;
  const format = options.format ?? 'ai';

  try {
    const detected = detectLibraries(config.projectRoot);
    const suggestions = getSuggestions(detected);

    if (detected.length === 0) {
      if (format === 'json') {
        console.log(
          JSON.stringify(
            {
              detected: [],
              suggestions: { toFetch: [], toRefresh: [] },
              message: 'No supported libraries found in package.json',
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(`<docs-detect count="0">
  <message>No supported libraries found in package.json</message>
</docs-detect>`);
      return;
    }

    if (format === 'json') {
      console.log(
        JSON.stringify(
          {
            count: detected.length,
            detected: detected.map((d) => ({
              name: d.name,
              version: d.version,
              isCached: d.isCached,
              isExpired: d.isExpired,
              context7Id: d.context7Id,
            })),
            suggestions,
          },
          null,
          2,
        ),
      );
      return;
    }

    const lines = [`<docs-detect count="${detected.length}">`];
    for (const lib of detected) {
      const status = lib.isCached ? (lib.isExpired ? 'expired' : 'cached') : 'not_cached';
      lines.push(`  <library name="${lib.name}" version="${lib.version}" status="${status}">`);
      if (lib.context7Id) lines.push(`    <context7-id>${lib.context7Id}</context7-id>`);
      lines.push(`  </library>`);
    }

    if (suggestions.toFetch.length > 0) {
      lines.push(`  <suggestions>`);
      lines.push(`    <to-fetch>${suggestions.toFetch.join(', ')}</to-fetch>`);
      if (suggestions.toRefresh.length > 0) {
        lines.push(`    <to-refresh>${suggestions.toRefresh.join(', ')}</to-refresh>`);
      }
      lines.push(`  </suggestions>`);
    }

    lines.push(`</docs-detect>`);
    console.log(lines.join('\n'));
  } catch {
    if (format === 'json') {
      console.log(
        JSON.stringify(
          {
            detected: [],
            suggestions: { toFetch: [], toRefresh: [] },
          },
          null,
          2,
        ),
      );
      return;
    }

    console.log(`<docs-detect>
  <message>Could not detect libraries</message>
</docs-detect>`);
  }
}

/**
 * Clear documentation cache
 */
export async function runDocsClear(
  ctx: CommandContext & { options: DocsClearOptions },
): Promise<void> {
  const { options } = ctx;
  const format = options.format ?? 'ai';

  try {
    if (options.library) {
      // Clear specific library
      const lib = getLibraryByName(options.library);
      if (!lib) {
        if (format === 'json') {
          console.log(
            JSON.stringify(
              { cleared: 0, message: `Library "${options.library}" not found in cache` },
              null,
              2,
            ),
          );
          return;
        }
        console.log(`<docs-clear count="0">
  <message>Library "${options.library}" not found in cache</message>
</docs-clear>`);
        return;
      }

      deleteLibrary(lib.libraryId);

      if (format === 'json') {
        console.log(
          JSON.stringify(
            {
              cleared: 1,
              library: options.library,
              message: `Cleared cache for ${options.library}`,
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(`<docs-clear count="1">
  <cleared>${options.library}</cleared>
</docs-clear>`);
      return;
    }

    if (options.expired) {
      // Clear only expired
      const result = clearExpired();

      if (format === 'json') {
        console.log(
          JSON.stringify(
            {
              librariesCleared: result.librariesDeleted,
              sectionsCleared: result.sectionsDeleted,
              message: `Cleared ${result.librariesDeleted} expired libraries`,
            },
            null,
            2,
          ),
        );
        return;
      }

      console.log(`<docs-clear libraries="${result.librariesDeleted}" sections="${result.sectionsDeleted}">
  <message>Cleared expired entries</message>
</docs-clear>`);
      return;
    }

    // Clear all - list first to show count
    const libraries = listLibraries();
    for (const lib of libraries) {
      deleteLibrary(lib.libraryId);
    }

    if (format === 'json') {
      console.log(JSON.stringify({ cleared: libraries.length, message: 'Cache cleared' }, null, 2));
      return;
    }

    console.log(`<docs-clear count="${libraries.length}">
  <message>Cache cleared</message>
</docs-clear>`);
  } catch {
    if (format === 'json') {
      console.log(JSON.stringify({ cleared: 0, message: 'Cache is empty' }, null, 2));
      return;
    }

    console.log(`<docs-clear count="0">
  <message>Cache is already empty</message>
</docs-clear>`);
  }
}
