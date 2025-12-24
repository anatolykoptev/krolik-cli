/**
 * @module mcp/tools/context
 * @description krolik_context tool - AI-friendly context generation
 */

import { buildFlags, type FlagSchema } from './flag-builder';
import { withProjectDetection } from './projects';
import { registerTool } from './registry';
import { COMMON_FLAGS, PROJECT_PROPERTY } from './shared';
import type { MCPToolDefinition } from './types';
import { runKrolik, TIMEOUT_60S } from './utils';

const contextSchema: FlagSchema = {
  feature: COMMON_FLAGS.feature,
  issue: COMMON_FLAGS.issue,
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
    },
  },
  handler: (args, workspaceRoot) => {
    const result = buildFlags(args, contextSchema);
    if (!result.ok) return result.error;

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`context ${result.flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(contextTool);
