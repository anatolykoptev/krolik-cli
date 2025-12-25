/**
 * @module mcp/tools/review
 * @description krolik_review tool - Code review
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
  template: { when: 'After code changes', params: '`staged: true`' },
  workflow: { trigger: 'before_commit', order: 1 },
  category: 'code',
  handler: (args, workspaceRoot) => {
    const result = buildFlags(args, reviewSchema);
    if (!result.ok) return result.error;

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`review ${result.flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(reviewTool);
