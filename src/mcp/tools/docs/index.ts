/**
 * @module mcp/tools/docs
 * @description krolik_docs tool - Documentation cache management
 */

import {
  buildFlags,
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  runKrolik,
  TIMEOUT_120S,
  withProjectDetection,
} from '../core';

const docsSchema = {
  library: { flag: '--library', sanitize: 'none' } as const,
  topic: { flag: '--topic', sanitize: 'none' } as const,
  limit: { flag: '--limit', sanitize: 'none' } as const,
  force: { flag: '--force' } as const,
  expired: { flag: '--expired' } as const,
};

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
  handler: (args, workspaceRoot) => {
    const action = args.action as string;

    // Validate action-specific requirements
    if (action === 'search' && !args.query) {
      return 'Error: query is required for search action';
    }
    if (action === 'fetch' && !args.library) {
      return 'Error: library is required for fetch action';
    }

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      switch (action) {
        case 'search': {
          const query = args.query as string;
          const result = buildFlags(args, {
            library: docsSchema.library,
            topic: docsSchema.topic,
            limit: docsSchema.limit,
          });
          if (!result.ok) return result.error;
          // Query is positional argument, must be quoted
          return runKrolik(`docs search "${query}" ${result.flags}`, projectPath, TIMEOUT_120S);
        }

        case 'list': {
          const result = buildFlags(args, {
            expired: docsSchema.expired,
          });
          if (!result.ok) return result.error;
          return runKrolik(`docs list ${result.flags}`, projectPath, TIMEOUT_120S);
        }

        case 'fetch': {
          const library = args.library as string;
          const result = buildFlags(args, {
            topic: docsSchema.topic,
            force: docsSchema.force,
          });
          if (!result.ok) return result.error;
          // Library is positional argument
          return runKrolik(`docs fetch "${library}" ${result.flags}`, projectPath, TIMEOUT_120S);
        }

        case 'detect': {
          return runKrolik('docs detect', projectPath, TIMEOUT_120S);
        }

        case 'clear': {
          const result = buildFlags(args, {
            library: docsSchema.library,
            expired: docsSchema.expired,
          });
          if (!result.ok) return result.error;
          return runKrolik(`docs clear ${result.flags}`, projectPath, TIMEOUT_120S);
        }

        default:
          return `Error: Unknown action: ${action}. Valid actions: search, list, fetch, detect, clear`;
      }
    });
  },
};

registerTool(docsTool);
