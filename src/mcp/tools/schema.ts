/**
 * @module mcp/tools/schema
 * @description krolik_schema tool - Prisma schema analysis
 */

import type { MCPToolDefinition } from './types';
import { PROJECT_PROPERTY } from './shared';
import { runKrolik } from './utils';
import { withProjectDetection } from './projects';

export const schemaTool: MCPToolDefinition = {
  name: 'krolik_schema',
  description:
    'Analyze Prisma database schema. Returns all models, fields, relations, and enums.',
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
      return runKrolik(`schema ${flags}`, projectPath);
    });
  },
};
