/**
 * @module mcp/tools/context
 * @description krolik_context tool - AI-friendly context generation
 *
 * PERFORMANCE: Uses direct imports instead of subprocess.
 * - Default mode for MCP is 'quick' (fastest)
 * - Fast response due to direct function calls
 */

import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

/**
 * Run lightweight context generation for MCP
 */
async function runLightweightContext(
  projectRoot: string,
  options: {
    feature?: string;
    issue?: string;
    quick?: boolean;
    deep?: boolean;
    full?: boolean;
    minimal?: boolean;
    smart?: boolean;
    budget?: number;
    signatures?: boolean;
    mapOnly?: boolean;
    search?: string;
    changedOnly?: boolean;
    withIssues?: boolean;
  },
): Promise<string> {
  // Dynamic imports to avoid loading heavy modules at startup
  const { generateContext } = await import('@/commands/context');
  const { formatAiPrompt } = await import('@/commands/context/formatters');
  const { isGitRepo, getStatus, getIssue } = await import('@/lib/@vcs');
  const { buildGitInfo } = await import('@/commands/context/builders');
  const { buildSmartContext } = await import('@/commands/context/smart-context');
  const { generateChecklist } = await import('@/commands/context/domains');
  const { buildQuickSections, buildMinimalSections } = await import('@/commands/context/modes');
  const { collectLibModules, searchInProject } = await import('@/commands/context/helpers');
  const { loadRelevantMemory, loadLibraryDocs } = await import('@/commands/context/sections');

  let task = options.feature || 'General development context';
  let issueData: { number: number; title: string; body: string; labels: string[] } | undefined;

  // Fetch issue if provided
  if (options.issue) {
    const issueNum = Number.parseInt(options.issue, 10);
    if (!Number.isNaN(issueNum)) {
      const issue = getIssue(issueNum, projectRoot);
      if (issue) {
        issueData = {
          number: issue.number,
          title: issue.title,
          body: issue.body,
          labels: issue.labels,
        };
        task = issue.title;
      }
    }
  }

  const result = generateContext(task, projectRoot, issueData);

  // Handle --changed-only
  if (options.changedOnly && isGitRepo(projectRoot)) {
    const status = getStatus(projectRoot);
    const changedFiles = [
      ...status.modified,
      ...status.staged.filter((f) => !status.modified.includes(f)),
      ...status.untracked,
    ];
    if (changedFiles.length > 0) {
      result.relatedFiles = changedFiles;
      result.domains = ['changed-files'];
    }
  }

  // Determine mode - default to quick for MCP
  const isMinimalMode = options.minimal === true;
  const isQuickMode = options.quick ?? (!options.deep && !options.full && !isMinimalMode);
  const isDeepMode = options.deep === true;

  type ContextMode = 'minimal' | 'quick' | 'deep' | 'full';
  const mode: ContextMode = isMinimalMode
    ? 'minimal'
    : isQuickMode
      ? 'quick'
      : isDeepMode
        ? 'deep'
        : 'full';

  // Build AI context data
  type AiContextData = {
    mode: ContextMode;
    generatedAt: string;
    context: typeof result;
    config: { projectRoot: string };
    checklist: string[];
    repoMap?: unknown;
    git?: unknown;
    searchResults?: unknown;
    libModules?: unknown;
    memories?: unknown;
    libraryDocs?: unknown;
  };

  const aiData: AiContextData = {
    mode,
    generatedAt: new Date().toISOString(),
    context: result,
    config: { projectRoot },
    checklist: generateChecklist(result.domains),
  };

  // Smart context (repo-map) - ALL modes
  try {
    aiData.repoMap = await buildSmartContext(projectRoot, result.domains, options);
  } catch {
    // Ignore errors in smart context
  }

  // Git information - ALL modes
  if (isGitRepo(projectRoot)) {
    aiData.git = buildGitInfo(projectRoot);
  }

  // Search results (--search option)
  if (options.search) {
    const searchResults = searchInProject(projectRoot, options.search);
    if (searchResults) {
      aiData.searchResults = searchResults;
    }
  }

  // Mode-specific building
  if (isMinimalMode) {
    buildMinimalSections(aiData as Parameters<typeof buildMinimalSections>[0], result, projectRoot);
    return formatAiPrompt(aiData as Parameters<typeof formatAiPrompt>[0]);
  }

  if (!isDeepMode) {
    await buildQuickSections(
      aiData as Parameters<typeof buildQuickSections>[0],
      result,
      projectRoot,
      options,
    );
  }

  // Lib modules (non-minimal modes)
  const libModules = collectLibModules(projectRoot);
  if (libModules) aiData.libModules = libModules;

  // Memory & docs (non-minimal modes)
  aiData.memories = loadRelevantMemory(projectRoot, result.domains);
  aiData.libraryDocs = await loadLibraryDocs(projectRoot, result.domains);

  return formatAiPrompt(aiData as Parameters<typeof formatAiPrompt>[0]);
}

export const contextTool: MCPToolDefinition = {
  name: 'krolik_context',
  description:
    'Generate AI-friendly context for a specific task or feature. Returns structured XML with schema, routes, git info, and approach steps.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      feature: {
        type: 'string',
        description: 'The feature or task to analyze (e.g., "booking", "auth", "CRM")',
      },
      issue: {
        type: 'string',
        description: 'GitHub issue number to get context for',
      },
      quick: {
        type: 'boolean',
        description: 'Quick mode: architecture, git, tree, schema, routes only (faster)',
      },
      deep: {
        type: 'boolean',
        description: 'Deep mode: imports, types, env, contracts (complements quick)',
      },
      full: {
        type: 'boolean',
        description:
          'Full mode: all enrichment (--include-code --domain-history --show-deps --with-audit)',
      },
      withIssues: {
        type: 'boolean',
        description: 'Include GitHub issues from gh CLI (requires gh authentication)',
      },
      smart: {
        type: 'boolean',
        description: 'Smart context using PageRank',
      },
      budget: {
        type: 'number',
        description: 'Token budget (default: 2000)',
      },
      signatures: {
        type: 'boolean',
        description: 'Show only signatures',
      },
      mapOnly: {
        type: 'boolean',
        description: 'Output only repo map',
      },
      search: {
        type: 'string',
        description: 'Search pattern - include files/code matching pattern',
      },
      changedOnly: {
        type: 'boolean',
        description: 'Include only changed files (from git status)',
      },
    },
  },
  template: { when: 'Before feature/issue work', params: '`feature: "..."` or `issue: "123"`' },
  workflow: { trigger: 'before_task', order: 1 },
  category: 'context',
  handler: async (args, workspaceRoot) => {
    // Resolve project path
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      if (resolved.error.includes('not found')) {
        return `<context error="true"><message>Project "${projectArg}" not found.</message></context>`;
      }
      return resolved.error;
    }

    try {
      const options: Parameters<typeof runLightweightContext>[1] = {};
      if (typeof args.feature === 'string') options.feature = args.feature;
      if (typeof args.issue === 'string') options.issue = args.issue;
      if (typeof args.quick === 'boolean') options.quick = args.quick;
      if (typeof args.deep === 'boolean') options.deep = args.deep;
      if (typeof args.full === 'boolean') options.full = args.full;
      if (typeof args.smart === 'boolean') options.smart = args.smart;
      if (typeof args.budget === 'number') options.budget = args.budget;
      if (typeof args.signatures === 'boolean') options.signatures = args.signatures;
      if (typeof args.mapOnly === 'boolean') options.mapOnly = args.mapOnly;
      if (typeof args.search === 'string') options.search = args.search;
      if (typeof args.changedOnly === 'boolean') options.changedOnly = args.changedOnly;
      if (typeof args.withIssues === 'boolean') options.withIssues = args.withIssues;

      const xml = await runLightweightContext(resolved.path, options);
      return xml;
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(contextTool);
