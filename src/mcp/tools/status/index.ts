/**
 * @module mcp/tools/status
 * @description krolik_status tool - Project diagnostics
 */

import {
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  runKrolik,
  withProjectDetection,
} from '../core';

export const statusTool: MCPToolDefinition = {
  name: 'krolik_status',
  description:
    'Get project diagnostics: git status, typecheck, lint, TODOs. Use this to understand the current state of the project.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      fast: {
        type: 'boolean',
        description: 'Skip slow checks (typecheck, lint) for faster response',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      const flags = args.fast ? '--fast' : '';
      return runKrolik(`status ${flags}`, projectPath);
    });
  },
};

registerTool(statusTool);
