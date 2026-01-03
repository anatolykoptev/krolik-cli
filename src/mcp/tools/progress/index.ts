/**
 * @module mcp/tools/progress
 * @description krolik_progress tool - Task/epic progress tracking
 */

import {
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  runKrolik,
  withProjectDetection,
} from '../core';

export const progressTool: MCPToolDefinition = {
  name: 'krolik_progress',
  description:
    'Task/epic progress tracking. Shows current tasks, epics, session info, and suggestions. Use --sync to sync with GitHub issues first.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      sync: {
        type: 'boolean',
        description: 'Sync with GitHub issues before showing progress',
      },
    },
  },
  template: { when: 'Need progress overview', params: '' },
  category: 'start',
  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      const flags = args.sync ? '--sync' : '';
      return runKrolik(`progress ${flags}`, projectPath);
    });
  },
};

registerTool(progressTool);
