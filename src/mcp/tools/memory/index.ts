/**
 * @module mcp/tools/memory
 * @description krolik_mem_* tools - Memory system for observations, decisions, patterns
 */

import {
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  runKrolik,
  TIMEOUT_60S,
  withProjectDetection,
} from '../core';

/**
 * krolik_mem_save - Save a memory entry
 */
export const memSaveTool: MCPToolDefinition = {
  name: 'krolik_mem_save',
  description: `Save memory: observation, decision, pattern, bugfix, or feature.

Examples:
- "Decided to use tRPC for type safety" (decision)
- "Fixed race condition with mutex" (bugfix)
- "All routes use validate -> execute -> audit pattern" (pattern)
- "Users prefer dark mode toggle in header" (observation)
- "Implemented real-time notifications with WebSockets" (feature)`,
  template: { when: 'Save decision/pattern/bugfix', params: '`type: "decision", title: "..."`' },
  workflow: { trigger: 'on_decision', order: 1 },
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      type: {
        type: 'string',
        enum: ['observation', 'decision', 'pattern', 'bugfix', 'feature'],
        description: 'Type of memory entry',
      },
      title: {
        type: 'string',
        description: 'Short summary (e.g., "Use tRPC for type safety")',
      },
      description: {
        type: 'string',
        description: 'Detailed description of the memory entry',
      },
      importance: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Importance level (default: medium)',
      },
      tags: {
        type: 'string',
        description: 'Comma-separated tags (e.g., "api, typescript, performance")',
      },
      files: {
        type: 'string',
        description: 'Comma-separated file paths related to this memory',
      },
      features: {
        type: 'string',
        description: 'Comma-separated features/domains (e.g., "booking, auth")',
      },
    },
    required: ['type', 'title', 'description'],
  },
  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      const flags: string[] = [];

      if (args.type) flags.push(`--type "${args.type}"`);
      if (args.title) flags.push(`--title "${String(args.title).replace(/"/g, '\\"')}"`);
      if (args.description)
        flags.push(`--description "${String(args.description).replace(/"/g, '\\"')}"`);
      if (args.importance) flags.push(`--importance "${args.importance}"`);
      if (args.tags) flags.push(`--tags "${args.tags}"`);
      if (args.files) flags.push(`--files "${args.files}"`);
      if (args.features) flags.push(`--features "${args.features}"`);

      return runKrolik(`mem save ${flags.join(' ')}`, projectPath, TIMEOUT_60S);
    });
  },
};

/**
 * krolik_mem_search - Search memory entries
 */
export const memSearchTool: MCPToolDefinition = {
  name: 'krolik_mem_search',
  description: `Search memory entries by query, type, tags, or feature.

Examples:
- Search for "tRPC" decisions
- Find all "performance" related entries
- Search patterns for "authentication"`,
  template: { when: 'Search memories by query', params: '`query: "authentication"`' },
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      query: {
        type: 'string',
        description: 'Search query (searches in title and description)',
      },
      type: {
        type: 'string',
        enum: ['observation', 'decision', 'pattern', 'bugfix', 'feature'],
        description: 'Filter by memory type',
      },
      tags: {
        type: 'string',
        description: 'Filter by tags (comma-separated)',
      },
      features: {
        type: 'string',
        description: 'Filter by feature/domain (comma-separated)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 10)',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      const flags: string[] = [];

      if (args.query) flags.push(`--query "${String(args.query).replace(/"/g, '\\"')}"`);
      if (args.type) flags.push(`--type "${args.type}"`);
      if (args.tags) flags.push(`--tags "${args.tags}"`);
      if (args.features) flags.push(`--features "${args.features}"`);
      if (args.limit) flags.push(`--limit ${args.limit}`);

      return runKrolik(`mem search ${flags.join(' ')}`, projectPath, TIMEOUT_60S);
    });
  },
};

/**
 * krolik_mem_recent - Get recent memory entries
 */
export const memRecentTool: MCPToolDefinition = {
  name: 'krolik_mem_recent',
  description: `Get recent memory entries, optionally filtered by type.

Useful for:
- Reviewing recent decisions
- Checking latest bugfixes
- Seeing recent patterns added`,
  template: { when: 'Get recent memories', params: '`limit: 5`' },
  workflow: { trigger: 'session_start', order: 2 },
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      limit: {
        type: 'number',
        description: 'Maximum number of entries to return (default: 10)',
      },
      type: {
        type: 'string',
        enum: ['observation', 'decision', 'pattern', 'bugfix', 'feature'],
        description: 'Filter by memory type',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      const flags: string[] = [];

      if (args.limit) flags.push(`--limit ${args.limit}`);
      if (args.type) flags.push(`--type "${args.type}"`);

      return runKrolik(`mem recent ${flags.join(' ')}`, projectPath, TIMEOUT_60S);
    });
  },
};

// Register all tools
registerTool(memSaveTool);
registerTool(memSearchTool);
registerTool(memRecentTool);
