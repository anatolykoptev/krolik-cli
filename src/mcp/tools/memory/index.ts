/**
 * @module mcp/tools/memory
 * @description krolik_mem_* tools - Memory system for observations, decisions, patterns
 *
 * Uses direct function imports instead of CLI subprocess calls for better performance.
 */

import * as path from 'node:path';
import { escapeXml, truncate } from '@/lib/@format';
import {
  type Memory,
  type MemoryContext,
  type MemorySaveOptions,
  type MemorySearchOptions,
  type MemorySearchResult,
  type MemoryType,
  recent,
  save,
  search,
} from '@/lib/@storage/memory';
import { getCurrentBranch, getRecentCommits, isGitRepo } from '../../../lib/@vcs';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError, formatMCPError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Git context result type
 */
interface GitContext {
  branch?: string | undefined;
  commit?: string | undefined;
}

/**
 * Get git context for memory storage
 */
function getGitContext(projectPath: string): GitContext {
  if (!isGitRepo(projectPath)) {
    return {};
  }

  const branch = getCurrentBranch(projectPath) ?? undefined;
  const commits = getRecentCommits(1, projectPath);
  const commit = commits[0]?.hash;

  return { branch, commit };
}

/**
 * Format a single memory entry as XML
 */
function formatMemoryXml(memory: Memory, relevance?: number): string {
  const lines: string[] = [];
  const relevanceAttr = relevance !== undefined ? ` relevance="${relevance.toFixed(2)}"` : '';

  lines.push(
    `  <memory id="${escapeXml(memory.id)}" type="${memory.type}" importance="${memory.importance}"${relevanceAttr}>`,
  );
  lines.push(`    <title>${escapeXml(memory.title)}</title>`);
  lines.push(`    <description>${escapeXml(truncate(memory.description, 500))}</description>`);
  lines.push(`    <project>${escapeXml(memory.project)}</project>`);

  if (memory.branch) {
    lines.push(`    <branch>${escapeXml(memory.branch)}</branch>`);
  }

  if (memory.commit) {
    lines.push(`    <commit>${escapeXml(memory.commit)}</commit>`);
  }

  if (memory.tags.length > 0) {
    lines.push(`    <tags>${memory.tags.map(escapeXml).join(', ')}</tags>`);
  }

  if (memory.files && memory.files.length > 0) {
    lines.push(`    <files>${memory.files.map(escapeXml).join(', ')}</files>`);
  }

  if (memory.features && memory.features.length > 0) {
    lines.push(`    <features>${memory.features.map(escapeXml).join(', ')}</features>`);
  }

  lines.push(`    <createdAt>${memory.createdAt}</createdAt>`);
  lines.push('  </memory>');

  return lines.join('\n');
}

// ============================================================================
// ARGUMENT INTERFACES
// ============================================================================

/**
 * Arguments for save action
 */
interface SaveArgs {
  type: MemoryType;
  title: string;
  description: string;
  importance?: 'low' | 'medium' | 'high' | 'critical' | undefined;
  tags?: string | undefined;
  files?: string | undefined;
  features?: string | undefined;
}

/**
 * Arguments for search action
 */
interface SearchArgs {
  query?: string | undefined;
  type?: MemoryType | undefined;
  tags?: string | undefined;
  features?: string | undefined;
  limit?: number | undefined;
}

/**
 * Arguments for recent action
 */
interface RecentArgs {
  type?: MemoryType | undefined;
  limit?: number | undefined;
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle save action - save a new memory entry
 */
function handleSave(args: SaveArgs, projectPath: string): string {
  const projectName = path.basename(projectPath);
  const gitContext = getGitContext(projectPath);

  const saveOptions: MemorySaveOptions = {
    type: args.type,
    title: args.title,
    description: args.description,
    importance: args.importance,
    tags: args.tags ? args.tags.split(',').map((t) => t.trim()) : undefined,
    files: args.files ? args.files.split(',').map((f) => f.trim()) : undefined,
    features: args.features ? args.features.split(',').map((f) => f.trim()) : undefined,
  };

  const context: MemoryContext = {
    project: projectName,
    branch: gitContext.branch,
    commit: gitContext.commit,
  };

  const memory = save(saveOptions, context);

  const lines: string[] = [
    '<memory-save status="success">',
    formatMemoryXml(memory),
    '</memory-save>',
  ];

  return lines.join('\n');
}

/**
 * Handle search action - search memory entries
 */
function handleSearch(args: SearchArgs, projectPath: string): string {
  const projectName = path.basename(projectPath);

  const searchOptions: MemorySearchOptions = {
    query: args.query,
    type: args.type,
    project: projectName,
    tags: args.tags ? args.tags.split(',').map((t) => t.trim()) : undefined,
    features: args.features ? args.features.split(',').map((f) => f.trim()) : undefined,
    limit: args.limit ?? 10,
  };

  const results: MemorySearchResult[] = search(searchOptions);

  if (results.length === 0) {
    return '<memory-search count="0"><message>No memories found matching the criteria.</message></memory-search>';
  }

  const lines: string[] = [`<memory-search count="${results.length}">`];

  for (const result of results) {
    lines.push(formatMemoryXml(result.memory, result.relevance));
  }

  lines.push('</memory-search>');
  return lines.join('\n');
}

/**
 * Handle recent action - get recent memory entries
 */
function handleRecent(args: RecentArgs, projectPath: string): string {
  const projectName = path.basename(projectPath);
  const limit = args.limit ?? 10;

  const memories: Memory[] = recent(projectName, limit, args.type);

  if (memories.length === 0) {
    const typeFilter = args.type ? ` of type "${args.type}"` : '';
    return `<memory-recent count="0"><message>No memories found${typeFilter}.</message></memory-recent>`;
  }

  const lines: string[] = [`<memory-recent count="${memories.length}">`];

  for (const memory of memories) {
    lines.push(formatMemoryXml(memory));
  }

  lines.push('</memory-recent>');
  return lines.join('\n');
}

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

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
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      // Check if it's a "project not found" vs "multiple projects" scenario
      if (resolved.error.includes('not found')) {
        return formatMCPError('E101', { requested: projectArg });
      }
      // Return as-is for project list (already formatted)
      return resolved.error;
    }

    const saveArgs: SaveArgs = {
      type: args.type as MemoryType,
      title: args.title as string,
      description: args.description as string,
      importance: args.importance as SaveArgs['importance'],
      tags: args.tags as string | undefined,
      files: args.files as string | undefined,
      features: args.features as string | undefined,
    };

    try {
      return handleSave(saveArgs, resolved.path);
    } catch (error) {
      return formatError(error);
    }
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
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      // Check if it's a "project not found" vs "multiple projects" scenario
      if (resolved.error.includes('not found')) {
        return formatMCPError('E101', { requested: projectArg });
      }
      // Return as-is for project list (already formatted)
      return resolved.error;
    }

    const searchArgs: SearchArgs = {
      query: args.query as string | undefined,
      type: args.type as MemoryType | undefined,
      tags: args.tags as string | undefined,
      features: args.features as string | undefined,
      limit: args.limit as number | undefined,
    };

    try {
      return handleSearch(searchArgs, resolved.path);
    } catch (error) {
      return formatError(error);
    }
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
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      return resolved.error;
    }

    const recentArgs: RecentArgs = {
      limit: args.limit as number | undefined,
      type: args.type as MemoryType | undefined,
    };

    try {
      return handleRecent(recentArgs, resolved.path);
    } catch (error) {
      return formatError(error);
    }
  },
};

// Register all tools
registerTool(memSaveTool);
registerTool(memSearchTool);
registerTool(memRecentTool);
