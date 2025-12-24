/**
 * @module mcp/tools/schema
 * @description krolik_schema tool - Prisma schema analysis
 */

import {
  buildFlags,
  COMMON_FLAGS,
  type FlagSchema,
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  runKrolik,
  withProjectDetection,
} from '../core';

const schemaFlagSchema: FlagSchema = {
  json: COMMON_FLAGS.json,
};

export const schemaTool: MCPToolDefinition = {
  name: 'krolik_schema',
  description: 'Analyze Prisma database schema. Returns all models, fields, relations, and enums.',
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
      const result = buildFlags(args, schemaFlagSchema);
      if (!result.ok) return result.error;
      return runKrolik(`schema ${result.flags}`, projectPath);
    });
  },
};

registerTool(schemaTool);
