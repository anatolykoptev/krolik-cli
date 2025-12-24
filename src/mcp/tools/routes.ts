/**
 * @module mcp/tools/routes
 * @description krolik_routes tool - tRPC routes analysis
 */

import { buildFlags, type FlagSchema } from './flag-builder';
import { withProjectDetection } from './projects';
import { registerTool } from './registry';
import { COMMON_FLAGS, PROJECT_PROPERTY } from './shared';
import type { MCPToolDefinition } from './types';
import { runKrolik } from './utils';

const routesFlagSchema: FlagSchema = {
  json: COMMON_FLAGS.json,
};

export const routesTool: MCPToolDefinition = {
  name: 'krolik_routes',
  description:
    'Analyze tRPC API routes. Returns all procedures with types, inputs, and protection status.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      json: {
        type: 'boolean',
        description: 'Return JSON format instead of markdown',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      const result = buildFlags(args, routesFlagSchema);
      if (!result.ok) return result.error;
      return runKrolik(`routes ${result.flags}`, projectPath);
    });
  },
};

registerTool(routesTool);
