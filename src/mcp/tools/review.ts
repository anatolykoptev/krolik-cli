/**
 * @module mcp/tools/review
 * @description krolik_review tool - Code review
 */

import { buildFlags, type FlagSchema } from './flag-builder';
import { withProjectDetection } from './projects';
import { registerTool } from './registry';
import { COMMON_FLAGS, PROJECT_PROPERTY } from './shared';
import type { MCPToolDefinition } from './types';
import { runKrolik, TIMEOUT_60S } from './utils';

const reviewSchema: FlagSchema = {
  staged: COMMON_FLAGS.staged,
  pr: COMMON_FLAGS.pr,
};

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
    const result = buildFlags(args, reviewSchema);
    if (!result.ok) return result.error;

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`review ${result.flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(reviewTool);
