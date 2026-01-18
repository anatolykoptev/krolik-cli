/**
 * @module mcp/tools/memory
 * @description krolik_mem_* tools - Memory system for observations, decisions, patterns
 *
 * Uses direct function imports instead of CLI subprocess calls for better performance.
 */

import * as path from 'node:path';
import { escapeXml, truncate } from '@/lib/@format';
import { type DocSearchResult, searchDocs } from '@/lib/@storage/docs';
import {
  // Links
  createLink,
  deleteLink,
  type GlobalMemorySaveOptions,
  type GlobalMemoryType,
  getEmbeddingsCount,
  getLinkStats,
  getMemoryChain,
  getMissingEmbeddingsCount,
  getSupersededMemories,
  // Hybrid search (BM25 + semantic with automatic fallback)
  hybridSearch,
  isEmbeddingsAvailable,
  isGlobalType,
  type LinkType,
  type Memory,
  type MemoryContext,
  type MemorySaveOptions,
  type MemorySearchResult,
  type MemorySource,
  type MemoryType,
  promote,
  recent,
  save,
  saveGlobal,
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
 * Format a single doc search result as XML
 */
function formatDocXml(result: DocSearchResult): string {
  const lines: string[] = [];
  lines.push(
    `  <doc library="${escapeXml(result.libraryName)}" relevance="${result.relevance.toFixed(2)}">`,
  );
  lines.push(`    <title>${escapeXml(result.section.title)}</title>`);
  lines.push(`    <content>${escapeXml(truncate(result.section.content, 300))}</content>`);
  if (result.section.topic) {
    lines.push(`    <topic>${escapeXml(result.section.topic)}</topic>`);
  }
  if (result.section.codeSnippets.length > 0) {
    lines.push(`    <snippets count="${result.section.codeSnippets.length}" />`);
  }
  lines.push('  </doc>');
  return lines.join('\n');
}

/**
 * Format a single memory entry as XML
 */
function formatMemoryXml(memory: Memory, relevance?: number): string {
  const lines: string[] = [];
  const relevanceAttr = relevance !== undefined ? ` relevance="${relevance.toFixed(2)}"` : '';
  const scopeAttr = memory.scope ? ` scope="${memory.scope}"` : '';
  const sourceAttr = memory.source ? ` source="${memory.source}"` : '';

  lines.push(
    `  <memory id="${escapeXml(memory.id)}" type="${memory.type}" importance="${memory.importance}"${scopeAttr}${sourceAttr}${relevanceAttr}>`,
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

  if (memory.usageCount && memory.usageCount > 0) {
    lines.push(`    <usageCount>${memory.usageCount}</usageCount>`);
  }

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
  /** Source of this memory */
  source?: MemorySource | undefined;
}

/**
 * Arguments for search action (hybrid BM25 + semantic)
 */
interface SearchArgs {
  query: string;
  limit?: number | undefined;
  /** Include docs search results (default: true) */
  includeDocs?: boolean | undefined;
  /** Limit for docs results (default: 5) */
  docsLimit?: number | undefined;
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
 * Handle save action - save a new memory entry with automatic embedding
 * Supports both project-scoped and global memories based on type
 */
async function handleSave(args: SaveArgs, projectPath: string): Promise<string> {
  const projectName = path.basename(projectPath);

  // Check if this should be a global memory (based on type)
  const shouldBeGlobal = isGlobalType(args.type);

  if (shouldBeGlobal) {
    // Save to global memory (no project context needed)
    const globalOptions: GlobalMemorySaveOptions = {
      type: args.type as GlobalMemoryType,
      title: args.title,
      description: args.description,
      importance: args.importance,
      tags: args.tags ? args.tags.split(',').map((t) => t.trim()) : undefined,
      source: args.source,
    };

    const memory = await saveGlobal(globalOptions);

    return [
      '<memory-save status="success" scope="global">',
      formatMemoryXml(memory),
      '</memory-save>',
    ].join('\n');
  }

  // Save to project memory
  const gitContext = getGitContext(projectPath);

  const saveOptions: MemorySaveOptions = {
    type: args.type,
    title: args.title,
    description: args.description,
    importance: args.importance,
    tags: args.tags ? args.tags.split(',').map((t) => t.trim()) : undefined,
    files: args.files ? args.files.split(',').map((f) => f.trim()) : undefined,
    features: args.features ? args.features.split(',').map((f) => f.trim()) : undefined,
    source: args.source,
  };

  const context: MemoryContext = {
    project: projectName,
    branch: gitContext.branch,
    commit: gitContext.commit,
  };

  const memory = await save(saveOptions, context);

  return [
    '<memory-save status="success" scope="project">',
    formatMemoryXml(memory),
    '</memory-save>',
  ].join('\n');
}

/**
 * Handle search action - unified search across memories and docs
 * Automatically falls back to BM25-only if embeddings unavailable
 */
async function handleSearch(args: SearchArgs, projectPath: string): Promise<string> {
  const projectName = path.basename(projectPath);
  const includeDocs = args.includeDocs !== false; // Default: true
  const docsLimit = args.docsLimit ?? 5;

  // Use hybrid search (BM25 + semantic) with automatic fallback
  const memoryResults: MemorySearchResult[] = await hybridSearch(args.query, {
    project: projectName,
    limit: args.limit ?? 10,
    // Hybrid search params with sensible defaults
    semanticWeight: 0.5,
    bm25Weight: 0.5,
    minSimilarity: 0.3,
  });

  // Search docs if enabled
  let docsResults: DocSearchResult[] = [];
  if (includeDocs) {
    try {
      docsResults = searchDocs({
        query: args.query,
        limit: docsLimit,
      });
    } catch {
      // Docs search failed, continue without docs
    }
  }

  // If both empty
  if (memoryResults.length === 0 && docsResults.length === 0) {
    return '<unified-search count="0"><message>No results found matching the criteria.</message></unified-search>';
  }

  // Check if semantic search was used
  const searchMode = isEmbeddingsAvailable() ? 'hybrid' : 'bm25';

  // Count by scope for summary
  const projectCount = memoryResults.filter((r) => r.memory.scope !== 'global').length;
  const globalCount = memoryResults.filter((r) => r.memory.scope === 'global').length;

  const lines: string[] = [
    `<unified-search mode="${searchMode}" memoryCount="${memoryResults.length}" docsCount="${docsResults.length}">`,
  ];

  // Memory results section
  if (memoryResults.length > 0) {
    lines.push(
      `  <memories count="${memoryResults.length}" projectCount="${projectCount}" globalCount="${globalCount}">`,
    );
    for (const result of memoryResults) {
      lines.push(formatMemoryXml(result.memory, result.relevance).replace(/^/gm, '  '));
    }
    lines.push('  </memories>');
  }

  // Docs results section
  if (docsResults.length > 0) {
    lines.push(`  <docs count="${docsResults.length}">`);
    for (const result of docsResults) {
      lines.push(formatDocXml(result).replace(/^/gm, '  '));
    }
    lines.push('  </docs>');
  }

  lines.push('</unified-search>');
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
 *
 * Supports hybrid memory architecture:
 * - Project-scoped: observation, decision, bugfix, feature (stored per-project)
 * - Global-scoped: pattern, library, snippet, anti-pattern (shared across projects)
 */
export const memSaveTool: MCPToolDefinition = {
  name: 'krolik_mem_save',
  description: `Save memory: observation, decision, pattern, bugfix, or feature.

**Project-scoped types** (stored per-project):
- observation: User preferences, project-specific notes
- decision: Architecture decisions, tech choices
- bugfix: Bug fixes with root cause analysis
- feature: Implemented features

**Global types** (shared across all projects):
- pattern: Reusable code patterns
- library: Library API knowledge (from context7)
- snippet: Reusable code snippets
- anti-pattern: Things to avoid

Examples:
- "Decided to use tRPC for type safety" (decision → project)
- "Fixed race condition with mutex" (bugfix → project)
- "All routes use validate -> execute -> audit" (pattern → global)
- "React Query staleTime: 5min for lists" (library → global)`,
  template: { when: 'Save decision/pattern/bugfix', params: '`type: "decision", title: "..."`' },
  workflow: { trigger: 'on_decision', order: 1 },
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      type: {
        type: 'string',
        enum: [
          'observation',
          'decision',
          'bugfix',
          'feature',
          'pattern',
          'library',
          'snippet',
          'anti-pattern',
        ],
        description:
          'Type of memory. Project types: observation, decision, bugfix, feature. Global types: pattern, library, snippet, anti-pattern',
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
        description: 'Comma-separated file paths related to this memory (project types only)',
      },
      features: {
        type: 'string',
        description: 'Comma-separated features/domains (e.g., "booking, auth")',
      },
      source: {
        type: 'string',
        enum: ['manual', 'context7', 'ai-generated'],
        description: 'Source of this memory (default: manual)',
      },
      promote: {
        type: 'boolean',
        description:
          'Set to true to promote an existing project memory to global scope. Requires id parameter.',
      },
      id: {
        type: 'string',
        description: 'Memory ID to promote (only used with promote: true)',
      },
    },
    required: ['type', 'title', 'description'],
  },
  handler: async (args, workspaceRoot) => {
    // Handle promote action
    if (args.promote === true && args.id) {
      try {
        const promoted = await promote(args.id as string);
        if (!promoted) {
          return '<memory-promote status="error"><message>Memory not found or already global</message></memory-promote>';
        }
        return [
          '<memory-promote status="success">',
          formatMemoryXml(promoted),
          '</memory-promote>',
        ].join('\n');
      } catch (error) {
        return formatError(error);
      }
    }

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
      source: args.source as MemorySource | undefined,
    };

    try {
      return await handleSave(saveArgs, resolved.path);
    } catch (error) {
      return formatError(error);
    }
  },
};

/**
 * krolik_mem_search - Unified search across memories and cached documentation
 * Automatically falls back to BM25 if embeddings unavailable
 */
export const memSearchTool: MCPToolDefinition = {
  name: 'krolik_mem_search',
  description: `Search memory entries using hybrid BM25 + semantic search.

**Unified search** - searches both memories AND cached library documentation.
Combines keyword matching with AI semantic understanding.
Automatically falls back to keyword-only search if AI model unavailable.

**Searches:**
- Project memories (decisions, bugfixes, features, observations)
- Global memories (patterns, snippets, library knowledge)
- Cached documentation from krolik_docs (if includeDocs=true)

Examples:
- "how do we handle authentication" finds JWT-related decisions
- "database performance" finds Prisma optimization bugfixes
- "user sessions" finds related patterns across projects
- "app router" finds Next.js docs if cached`,
  template: { when: 'Search memories by query', params: '`query: "authentication"`' },
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      query: {
        type: 'string',
        description: 'Natural language search query',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of memory results (default: 10)',
      },
      includeDocs: {
        type: 'boolean',
        description: 'Include cached documentation in search results (default: true)',
      },
      docsLimit: {
        type: 'number',
        description: 'Maximum number of docs results (default: 5)',
      },
    },
    required: ['query'],
  },
  handler: async (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      if (resolved.error.includes('not found')) {
        return formatMCPError('E101', { requested: projectArg });
      }
      return resolved.error;
    }

    const searchArgs: SearchArgs = {
      query: args.query as string,
      limit: args.limit as number | undefined,
      includeDocs: args.includeDocs as boolean | undefined,
      docsLimit: args.docsLimit as number | undefined,
    };

    try {
      return await handleSearch(searchArgs, resolved.path);
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
- Seeing recent patterns added
- Listing global library knowledge`,
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
        enum: [
          'observation',
          'decision',
          'bugfix',
          'feature',
          'pattern',
          'library',
          'snippet',
          'anti-pattern',
        ],
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

// ============================================================================
// MEMORY LINK TOOL
// ============================================================================

/**
 * krolik_mem_link - Create relationship between memories
 */
export const memLinkTool: MCPToolDefinition = {
  name: 'krolik_mem_link',
  description: `Create a relationship between two memories.

Link types:
- **caused**: This memory caused/led to the linked memory
- **related**: General relationship
- **supersedes**: This memory replaces the linked memory (marks old as outdated)
- **implements**: This memory implements the linked decision
- **contradicts**: This memory contradicts the linked memory

Examples:
- Decision 123 led to bugfix 456: fromId=123, toId=456, linkType="caused"
- New decision 789 replaces old: fromId=789, toId=123, linkType="supersedes"`,
  template: { when: 'Link two memories', params: '`fromId: 123, toId: 456, linkType: "caused"`' },
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      fromId: {
        type: 'number',
        description: 'Source memory ID',
      },
      toId: {
        type: 'number',
        description: 'Target memory ID',
      },
      linkType: {
        type: 'string',
        enum: ['caused', 'related', 'supersedes', 'implements', 'contradicts'],
        description: 'Type of relationship',
      },
      action: {
        type: 'string',
        enum: ['create', 'delete'],
        description: 'Action to perform (default: create)',
      },
    },
    required: ['fromId', 'toId', 'linkType'],
  },
  handler: (args) => {
    const fromId = args.fromId as number;
    const toId = args.toId as number;
    const linkType = args.linkType as LinkType;
    const action = (args.action as string) ?? 'create';

    try {
      if (action === 'delete') {
        const deleted = deleteLink(fromId, toId, linkType);
        return `<memory-link action="delete" deleted="${deleted}">
  <message>${deleted > 0 ? 'Link deleted successfully' : 'Link not found'}</message>
</memory-link>`;
      }

      const link = createLink(fromId, toId, linkType);
      if (!link) {
        return `<memory-link action="create" status="failed">
  <message>Failed to create link. Memories may not exist or link already exists.</message>
</memory-link>`;
      }

      return `<memory-link action="create" status="success">
  <link id="${link.id}" from="${link.fromId}" to="${link.toId}" type="${link.linkType}" />
</memory-link>`;
    } catch (error) {
      return formatError(error);
    }
  },
};

// ============================================================================
// MEMORY CHAIN TOOL
// ============================================================================

/**
 * krolik_mem_chain - Traverse memory graph
 */
export const memChainTool: MCPToolDefinition = {
  name: 'krolik_mem_chain',
  description: `Get related memories by traversing the memory graph.

Directions:
- **forward**: Follow outgoing links (what this led to)
- **backward**: Follow incoming links (what led to this)
- **both**: Both directions

Examples:
- See all consequences of a decision: direction="forward"
- See what led to a bugfix: direction="backward"
- See full context around a memory: direction="both"`,
  template: { when: 'Get memory chain', params: '`memoryId: 123, direction: "both"`' },
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      memoryId: {
        type: 'number',
        description: 'Starting memory ID',
      },
      direction: {
        type: 'string',
        enum: ['forward', 'backward', 'both'],
        description: 'Traversal direction (default: both)',
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum traversal depth (default: 3)',
      },
    },
    required: ['memoryId'],
  },
  handler: (args) => {
    const memoryId = args.memoryId as number;
    const direction = (args.direction as 'forward' | 'backward' | 'both') ?? 'both';
    const maxDepth = (args.maxDepth as number) ?? 3;

    try {
      const chain = getMemoryChain(memoryId, direction, maxDepth);

      if (chain.length === 0) {
        return `<memory-chain count="0" start="${memoryId}">
  <message>No memories found in chain.</message>
</memory-chain>`;
      }

      const lines: string[] = [
        `<memory-chain count="${chain.length}" start="${memoryId}" direction="${direction}" maxDepth="${maxDepth}">`,
      ];

      for (const memory of chain) {
        lines.push(formatMemoryXml(memory));
      }

      lines.push('</memory-chain>');
      return lines.join('\n');
    } catch (error) {
      return formatError(error);
    }
  },
};

// ============================================================================
// MEMORY OUTDATED TOOL
// ============================================================================

/**
 * krolik_mem_outdated - List superseded memories
 */
export const memOutdatedTool: MCPToolDefinition = {
  name: 'krolik_mem_outdated',
  description: `List superseded/outdated memories that have been replaced by newer ones.

Use this to:
- Find obsolete decisions that should be ignored
- Clean up old patterns that are no longer valid
- Review what has changed over time`,
  template: { when: 'Find outdated memories', params: '' },
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
    },
  },
  handler: (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      return resolved.error;
    }

    const projectName = path.basename(resolved.path);

    try {
      const outdated = getSupersededMemories(projectName);

      if (outdated.length === 0) {
        return `<memory-outdated count="0">
  <message>No superseded memories found. All memories are current.</message>
</memory-outdated>`;
      }

      const lines: string[] = [`<memory-outdated count="${outdated.length}">`];
      lines.push('  <warning>These memories have been superseded by newer ones.</warning>');

      for (const memory of outdated) {
        lines.push(formatMemoryXml(memory));
      }

      lines.push('</memory-outdated>');
      return lines.join('\n');
    } catch (error) {
      return formatError(error);
    }
  },
};

// ============================================================================
// MEMORY STATS TOOL
// ============================================================================

/**
 * krolik_mem_stats - Get memory and link statistics
 */
export const memStatsTool: MCPToolDefinition = {
  name: 'krolik_mem_stats',
  description: `Get statistics about memories, embeddings, and links.

Shows:
- Total memories by type and scope
- Embedding coverage (how many have semantic search enabled)
- Link statistics (relationships between memories)`,
  template: { when: 'Get memory stats', params: '' },
  category: 'memory',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
    },
  },
  handler: (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      return resolved.error;
    }

    try {
      const embeddingsCount = getEmbeddingsCount();
      const missingEmbeddings = getMissingEmbeddingsCount();
      const linkStats = getLinkStats();
      const embeddingsAvailable = isEmbeddingsAvailable();

      const lines: string[] = ['<memory-stats>'];

      // Embeddings stats
      lines.push('  <embeddings>');
      lines.push(`    <available>${embeddingsAvailable}</available>`);
      lines.push(`    <count>${embeddingsCount}</count>`);
      lines.push(`    <missing>${missingEmbeddings}</missing>`);
      lines.push(
        `    <coverage>${embeddingsCount + missingEmbeddings > 0 ? Math.round((embeddingsCount / (embeddingsCount + missingEmbeddings)) * 100) : 0}%</coverage>`,
      );
      lines.push('  </embeddings>');

      // Link stats
      lines.push('  <links>');
      lines.push(`    <total>${linkStats.total}</total>`);
      for (const [type, count] of Object.entries(linkStats.byType)) {
        if (count > 0) {
          lines.push(`    <${type}>${count}</${type}>`);
        }
      }
      lines.push('  </links>');

      lines.push('</memory-stats>');
      return lines.join('\n');
    } catch (error) {
      return formatError(error);
    }
  },
};

// Register all tools
registerTool(memSaveTool);
registerTool(memSearchTool);
registerTool(memRecentTool);
registerTool(memLinkTool);
registerTool(memChainTool);
registerTool(memOutdatedTool);
registerTool(memStatsTool);
