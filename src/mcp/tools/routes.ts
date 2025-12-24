/**
 * @module mcp/tools/routes
 * @description krolik_routes tool - tRPC routes analysis
 */

import type { MCPToolDefinition } from './types';
import { PROJECT_PROPERTY } from './shared';
import { runKrolik } from './utils';
import { withProjectDetection } from './projects';

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
      const flags = args.json ? '--json' : '';
      return runKrolik(`routes ${flags}`, projectPath);
    });
  },
};
