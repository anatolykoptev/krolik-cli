/**
 * @module mcp/tools/docs
 * @description krolik_docs tool - Documentation cache management
 *
 * Uses direct function imports instead of CLI subprocess calls for better performance.
 */

import { escapeXml, truncate } from '@/lib/@format';
import {
  detectLibraries,
  fetchAndCacheDocs,
  getSuggestions,
  hasContext7ApiKey,
} from '@/lib/@integrations/context7';
import {
  clearExpired,
  deleteLibrary,
  getLibraryByName,
  listLibraries,
  searchDocs,
} from '@/lib/@storage/docs';
import {
  type ActionDefinition,
  formatToolError,
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  validateActionRequirements,
  withErrorHandler,
} from '../core';
import { resolveProjectPath } from '../core/projects';

// ============================================================================
// ACTION DEFINITIONS
// ============================================================================

const DOCS_ACTIONS: Record<string, ActionDefinition> = {
  search: { requires: [{ param: 'query', message: 'query is required for search action' }] },
  list: {},
  fetch: { requires: [{ param: 'library', message: 'library is required for fetch action' }] },
  detect: {},
  clear: {},
};

// ============================================================================
// ACTION HANDLERS
// ============================================================================

interface DocsArgs {
  query?: string | undefined;
  library?: string | undefined;
  topic?: string | undefined;
  documentType?: 'legal' | 'technical' | 'general' | 'personal' | undefined;
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
    documentType: args.documentType,
    limit: args.limit ?? 10,
  });

  if (results.length === 0) {
    const libraryHint = args.library
      ? `\n  <suggestion>Use krolik_docs with action: "fetch" and library: "${escapeXml(args.library)}" to cache documentation first</suggestion>`
      : '\n  <suggestion>Use krolik_docs with action: "detect" to find project libraries, then fetch them</suggestion>';

    const context7Hint = `\n  <context7-alternative>
    Or use Context7 MCP tools directly:
    1. mcp__context7__resolve-library-id({ libraryName: "your-library" })
    2. mcp__context7__query-docs({ libraryId: "resolved-id", query: "${escapeXml(query)}" })
  </context7-alternative>`;

    return `<docs-search count="0">
  <message>No results found in krolik docs cache. Try different keywords or fetch library docs first.</message>${libraryHint}${context7Hint}
</docs-search>`;
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
    // Fallback to MCP Context7 tools if API key not available
    return `<docs-fetch status="mcp_fallback" library="${escapeXml(library)}">
  <message>CONTEXT7_API_KEY not set. Use Context7 MCP tools to fetch documentation:</message>
  <instruction>
    1. Call mcp__context7__resolve-library-id with libraryName: "${escapeXml(library)}"
    2. Call mcp__context7__query-docs with the resolved libraryId and query: "${escapeXml(topic ?? `${library} documentation`)}"
    3. The results will be returned directly - no need to call krolik_docs fetch again
  </instruction>
  <example>
    mcp__context7__resolve-library-id({
      libraryName: "${escapeXml(library)}",
      query: "${escapeXml(topic ?? `${library} documentation`)}"
    })
    // Then use the returned library ID in:
    mcp__context7__query-docs({
      libraryId: "/org/project",
      query: "${escapeXml(topic ?? `${library} usage examples`)}"
    })
  </example>
  <alternative>Set CONTEXT7_API_KEY in .env to enable direct caching</alternative>
</docs-fetch>`;
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

**Document Classification**:
- legal: State laws, regulations, compliance requirements
- technical: Library/framework API documentation (Next.js, React, tRPC)
- general: General how-to guides, tutorials
- personal: User's personal notes and documentation

**Context7 Integration**:
- If CONTEXT7_API_KEY is not set, krolik_docs will suggest using Context7 MCP tools directly
- Use mcp__context7__resolve-library-id to find library IDs
- Use mcp__context7__query-docs for direct documentation queries
- krolik_docs provides instructions for seamless fallback to Context7 MCP

Examples:
- Search all: { action: "search", query: "app router server components" }
- Search legal docs only: { action: "search", query: "mini-WARN requirements", documentType: "legal" }
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
      documentType: {
        type: 'string',
        enum: ['legal', 'technical', 'general', 'personal'],
        description: 'Filter by document type (for action: search)',
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

    // Validate action requirements using shared utility
    const validationError = validateActionRequirements(action, args, DOCS_ACTIONS);
    if (validationError) return validationError;

    // Resolve project path (only needed for detect action)
    let projectPath = workspaceRoot;
    if (action === 'detect') {
      const projectArg = typeof args.project === 'string' ? args.project : undefined;
      const resolved = resolveProjectPath(workspaceRoot, projectArg);
      if ('error' in resolved) {
        return resolved.error;
      }
      projectPath = resolved.path;
    }

    // Type-safe args for action handlers
    const docsArgs: DocsArgs = {
      query: args.query as string | undefined,
      library: args.library as string | undefined,
      topic: args.topic as string | undefined,
      documentType: args.documentType as 'legal' | 'technical' | 'general' | 'personal' | undefined,
      limit: args.limit as number | undefined,
      force: args.force as boolean | undefined,
      expired: args.expired as boolean | undefined,
    };

    // Use consistent error handling wrapper
    return withErrorHandler('docs', action, async () => {
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
          // This should never happen due to validateActionRequirements
          return formatToolError('docs', action, `Unknown action: ${action}`);
      }
    });
  },
};

registerTool(docsTool);
