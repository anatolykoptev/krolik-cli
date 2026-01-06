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
  model: { flag: '--model' },
  domain: { flag: '--domain' },
  compact: { flag: '--compact' },
  full: { flag: '--full' },
};

export const schemaTool: MCPToolDefinition = {
  name: 'krolik_schema',
  description: `Analyze Prisma database schema. Returns models, fields, relations, and enums.

**Output modes:**
- (default) Smart format - AI-optimized, hides standard fields (id, createdAt, updatedAt), obvious defaults
- compact: true - overview only, models with relations (smallest output)
- full: true - verbose legacy format with all fields and attributes

**Filters:**
- model: "User" - filter by model name (partial match)
- domain: "Auth" - filter by domain (derived from schema filename)`,
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      json: {
        type: 'boolean',
        description: 'Return JSON format instead of XML',
      },
      model: {
        type: 'string',
        description:
          'Filter by model name (partial match, case-insensitive). Example: "User", "Booking"',
      },
      domain: {
        type: 'string',
        description:
          'Filter by domain (derived from schema filename). Example: "Auth", "Bookings", "CRM"',
      },
      compact: {
        type: 'boolean',
        description:
          'Compact output - models with relations only, no field details. Smallest output.',
      },
      full: {
        type: 'boolean',
        description:
          'Full verbose output - all fields with all attributes. Use only when you need complete details.',
      },
    },
  },
  template: { when: 'DB schema questions', params: '—' },
  category: 'context',
  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      const result = buildFlags(args, schemaFlagSchema);
      if (!result.ok) return result.error;
      return runKrolik(`schema ${result.flags}`, projectPath);
    });
  },
};

registerTool(schemaTool);
