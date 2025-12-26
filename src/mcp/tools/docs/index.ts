/**
 * @module mcp/tools/docs
 * @description krolik_docs tool - Documentation cache management
 *
 * Uses direct function imports instead of CLI subprocess calls for better performance.
 */

import {
  clearExpired,
  deleteLibrary,
  detectLibraries,
  fetchAndCacheDocs,
  getLibraryByName,
  getSuggestions,
  hasContext7ApiKey,
  listLibraries,
  searchDocs,
} from '../../../lib/@docs-cache';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { escapeXml, truncate } from '../core/formatting';
import { resolveProjectPath } from '../core/projects';

// ============================================================================
// ACTION HANDLERS
// ============================================================================

interface DocsArgs {
  query?: string | undefined;
  library?: string | undefined;
  topic?: string | undefined;
  limit?: number | undefined;
  force?: boolean | undefined;
  expired?: boolean | undefined;
}

/**
 * Handle search action - full-text search across cached docs
 */
function handleSearch(args: DocsArgs): string {
  const query = args.query as string;
  const results = searchDocs({
    query,
    library: args.library,
    topic: args.topic,
    limit: args.limit ?? 10,
  });

  if (results.length === 0) {
    return '<docs-search count="0"><message>No results found. Try different keywords or fetch library docs first.</message></docs-search>';
  }

  const lines = [`<docs-search query="${escapeXml(query)}" count="${results.length}">`];

  for (const r of results) {
    lines.push(
      `  <result library="${escapeXml(r.libraryName)}" relevance="${r.relevance.toFixed(2)}">`,
    );
    lines.push(`    <title>${escapeXml(r.section.title)}</title>`);
    lines.push(`    <content>${escapeXml(truncate(r.section.content, 500))}</content>`);

    if (r.section.codeSnippets.length > 0) {
      lines.push(`    <snippets count="${r.section.codeSnippets.length}">`);
      for (const snippet of r.section.codeSnippets.slice(0, 2)) {
        lines.push(`      <code>${escapeXml(truncate(snippet, 300))}</code>`);
      }
      lines.push('    </snippets>');
    }
    lines.push('  </result>');
  }

  lines.push('</docs-search>');
  return lines.join('\n');
}

/**
 * Handle list action - list all cached libraries
 */
function handleList(args: DocsArgs): string {
  let libs = listLibraries();
  if (args.expired) {
    libs = libs.filter((l) => l.isExpired);
  }

  if (libs.length === 0) {
    const msg = args.expired
      ? 'No expired libraries in cache.'
      : 'No libraries cached. Use action: "detect" to find libraries or "fetch" to add one.';
    return `<docs-list count="0"><message>${msg}</message></docs-list>`;
  }

  const lines = [`<docs-list count="${libs.length}">`];

  for (const lib of libs) {
    const status = lib.isExpired ? 'expired' : 'valid';
    lines.push(
      `  <library name="${escapeXml(lib.name)}" status="${status}" snippets="${lib.totalSnippets}">`,
    );
    lines.push(`    <id>${escapeXml(lib.libraryId)}</id>`);
    lines.push(`    <fetched>${lib.fetchedAt}</fetched>`);
    lines.push(`    <expires>${lib.expiresAt}</expires>`);
    lines.push('  </library>');
  }

  lines.push('</docs-list>');
  return lines.join('\n');
}

/**
 * Handle fetch action - fetch docs from Context7 API
 */
async function handleFetch(args: DocsArgs): Promise<string> {
  const library = args.library as string;
  const topic = args.topic;
  const force = args.force ?? false;

  if (!hasContext7ApiKey()) {
    return '<docs-fetch status="error"><message>CONTEXT7_API_KEY not set. Please set the environment variable to fetch documentation.</message></docs-fetch>';
  }

  const result = await fetchAndCacheDocs(library, { topic, force });

  const lines = ['<docs-fetch status="success">'];
  lines.push(`  <library>${escapeXml(result.libraryName)}</library>`);
  lines.push(`  <id>${escapeXml(result.libraryId)}</id>`);
  lines.push(`  <sections>${result.sectionsAdded}</sections>`);
  lines.push(`  <snippets>${result.totalSnippets}</snippets>`);
  lines.push(`  <pages>${result.pages}</pages>`);
  lines.push(`  <fromCache>${result.fromCache}</fromCache>`);
  lines.push('</docs-fetch>');
  return lines.join('\n');
}

/**
 * Handle detect action - auto-detect libraries from package.json
 */
function handleDetect(projectPath: string): string {
  const detected = detectLibraries(projectPath);
  const { toFetch, toRefresh } = getSuggestions(detected);

  if (detected.length === 0) {
    return '<docs-detect count="0"><message>No supported libraries found in package.json.</message></docs-detect>';
  }

  const lines = [`<docs-detect count="${detected.length}">`];

  for (const lib of detected) {
    const status = lib.isCached ? (lib.isExpired ? 'expired' : 'cached') : 'not-cached';
    lines.push(
      `  <library name="${escapeXml(lib.name)}" version="${escapeXml(lib.version)}" status="${status}">`,
    );
    if (lib.context7Id) {
      lines.push(`    <context7Id>${escapeXml(lib.context7Id)}</context7Id>`);
    }
    lines.push('  </library>');
  }

  if (toFetch.length > 0) {
    lines.push(`  <suggestions type="fetch">${toFetch.join(', ')}</suggestions>`);
  }
  if (toRefresh.length > 0) {
    lines.push(`  <suggestions type="refresh">${toRefresh.join(', ')}</suggestions>`);
  }

  lines.push('</docs-detect>');
  return lines.join('\n');
}

/**
 * Handle clear action - clear cache entries
 */
function handleClear(args: DocsArgs): string {
  const library = args.library;
  const expiredOnly = args.expired ?? false;

  if (library) {
    const cached = getLibraryByName(library);
    if (!cached) {
      return `<docs-clear status="not-found"><message>Library "${library}" not found in cache.</message></docs-clear>`;
    }

    const deleted = deleteLibrary(cached.libraryId);
    if (deleted) {
      return `<docs-clear status="success"><message>Deleted library: ${library}</message></docs-clear>`;
    }
    return `<docs-clear status="error"><message>Failed to delete library: ${library}</message></docs-clear>`;
  }

  if (expiredOnly) {
    const result = clearExpired();
    return `<docs-clear status="success"><libraries>${result.librariesDeleted}</libraries><sections>${result.sectionsDeleted}</sections></docs-clear>`;
  }

  return '<docs-clear status="error"><message>Specify --library to clear a specific library or --expired to clear all expired entries.</message></docs-clear>';
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const docsTool: MCPToolDefinition = {
  name: 'krolik_docs',
  description: `Query and manage cached library documentation.

Actions:
- search: Full-text search across cached docs (FTS5)
- list: List all cached libraries with expiry status
- fetch: Fetch/refresh docs for a library from Context7
- detect: Auto-detect libraries from package.json
- clear: Clear cache (all or specific library)

Use this tool to:
- Find code examples and API documentation
- Check which libraries are cached
- Refresh outdated documentation
- Discover project dependencies that have docs available

Examples:
- Search: { action: "search", query: "app router server components" }
- List: { action: "list" }
- Fetch: { action: "fetch", library: "next.js", topic: "app-router" }
- Detect: { action: "detect" }`,

  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      action: {
        type: 'string',
        enum: ['search', 'list', 'fetch', 'detect', 'clear'],
        description: 'Action to perform',
      },
      query: {
        type: 'string',
        description: 'Search query (for action: search)',
      },
      library: {
        type: 'string',
        description: 'Library name (e.g., "next.js", "prisma", "trpc")',
      },
      topic: {
        type: 'string',
        description: 'Topic to focus on (e.g., "app-router", "transactions")',
      },
      limit: {
        type: 'number',
        description: 'Max results for search (default: 10)',
      },
      force: {
        type: 'boolean',
        description: 'Force refresh even if cache is valid',
      },
      expired: {
        type: 'boolean',
        description: 'For list/clear: only show/clear expired entries',
      },
    },
    required: ['action'],
  },

  template: { when: 'Need library API docs', params: '`action: "search", query: "..."`' },
  category: 'context',

  handler: async (args, workspaceRoot) => {
    const action = args.action as string;

    // Validate action-specific requirements
    if (action === 'search' && !args.query) {
      return 'Error: query is required for search action';
    }
    if (action === 'fetch' && !args.library) {
      return 'Error: library is required for fetch action';
    }

    // Resolve project path (needed for detect action)
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);
    if ('error' in resolved) {
      return resolved.error;
    }
    const projectPath = resolved.path;

    // Type-safe args for action handlers
    const docsArgs: DocsArgs = {
      query: args.query as string | undefined,
      library: args.library as string | undefined,
      topic: args.topic as string | undefined,
      limit: args.limit as number | undefined,
      force: args.force as boolean | undefined,
      expired: args.expired as boolean | undefined,
    };

    try {
      switch (action) {
        case 'search':
          return handleSearch(docsArgs);
        case 'list':
          return handleList(docsArgs);
        case 'fetch':
          return await handleFetch(docsArgs);
        case 'detect':
          return handleDetect(projectPath);
        case 'clear':
          return handleClear(docsArgs);
        default:
          return `Error: Unknown action: ${action}. Valid actions: search, list, fetch, detect, clear`;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return `<docs-error action="${escapeXml(action)}"><message>${escapeXml(message)}</message></docs-error>`;
    }
  },
};

registerTool(docsTool);
