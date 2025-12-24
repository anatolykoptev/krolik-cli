/**
 * @module mcp/tools/context
 * @description krolik_context tool - AI-friendly context generation
 */

import type { MCPToolDefinition } from './types';
import { PROJECT_PROPERTY } from './shared';
import { runKrolik, sanitizeFeatureName, sanitizeIssueNumber, escapeShellArg, TIMEOUT_60S } from './utils';
import { withProjectDetection } from './projects';

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
    const flagParts: string[] = [];

    if (args.feature) {
      const feature = sanitizeFeatureName(args.feature);
      if (!feature) {
        return 'Error: Invalid feature name. Only alphanumeric, hyphens, underscores allowed.';
      }
      flagParts.push(`--feature=${escapeShellArg(feature)}`);
    }

    if (args.issue) {
      const issue = sanitizeIssueNumber(args.issue);
      if (!issue) {
        return 'Error: Invalid issue number. Must be a positive integer.';
      }
      flagParts.push(`--issue=${issue}`);
    }

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`context ${flagParts.join(' ')}`, projectPath, TIMEOUT_60S);
    });
  },
};
