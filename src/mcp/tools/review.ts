/**
 * @module mcp/tools/review
 * @description krolik_review tool - Code review
 */

import { withProjectDetection } from './projects';
import { registerTool } from './registry';
import { PROJECT_PROPERTY } from './shared';
import type { MCPToolDefinition } from './types';
import { runKrolik, sanitizeIssueNumber, TIMEOUT_60S } from './utils';

export const reviewTool: MCPToolDefinition = {
  name: 'krolik_review',
  description:
    'Review code changes. Analyzes git diff for security issues, performance problems, and risks.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      staged: {
        type: 'boolean',
        description: 'Review only staged changes',
      },
      pr: {
        type: 'string',
        description: 'Review specific PR number',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    let flags = '';

    if (args.staged) {
      flags += ' --staged';
    }

    if (args.pr) {
      const pr = sanitizeIssueNumber(args.pr);
      if (!pr) {
        return 'Error: Invalid PR number. Must be a positive integer.';
      }
      flags += ` --pr=${pr}`;
    }

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`review ${flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(reviewTool);
