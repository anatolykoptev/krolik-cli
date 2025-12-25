/**
 * @module mcp/tools/context
 * @description krolik_context tool - AI-friendly context generation
 */

import {
  buildFlags,
  COMMON_FLAGS,
  type FlagSchema,
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  runKrolik,
  TIMEOUT_60S,
  withProjectDetection,
} from '../core';

const contextSchema: FlagSchema = {
  feature: COMMON_FLAGS.feature,
  issue: COMMON_FLAGS.issue,
  quick: { flag: '--quick' },
  deep: { flag: '--deep' },
  full: { flag: '--full' },
  withIssues: { flag: '--with-issues' },
};

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
    },
  },
  template: { when: 'Before feature/issue work', params: '`feature: "..."` or `issue: "123"`' },
  workflow: { trigger: 'before_task', order: 1 },
  category: 'context',
  handler: (args, workspaceRoot) => {
    const result = buildFlags(args, contextSchema);
    if (!result.ok) return result.error;

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`context ${result.flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(contextTool);
