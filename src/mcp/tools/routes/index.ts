/**
 * @module mcp/tools/routes
 * @description krolik_routes tool - tRPC routes analysis
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

const routesFlagSchema: FlagSchema = {
  json: COMMON_FLAGS.json,
  compact: { flag: '--compact' },
  full: { flag: '--full' },
};

export const routesTool: MCPToolDefinition = {
  name: 'krolik_routes',
  description: `Analyze tRPC API routes. Returns all procedures with types and protection status.

**Output modes:**
- (default) Smart format - groups procedures by type (queries/mutations), shows only unprotected as exceptions
- compact: true - overview only, routers with Q/M counts (smallest output)
- full: true - verbose legacy format with all procedure attributes`,
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      json: {
        type: 'boolean',
        description: 'Return JSON format instead of XML',
      },
      compact: {
        type: 'boolean',
        description: 'Compact output - routers with procedure counts only. Smallest output.',
      },
      full: {
        type: 'boolean',
        description:
          'Full verbose output - all procedures with all attributes. Use only when you need complete details.',
      },
    },
  },
  template: { when: 'API routes questions', params: '—' },
  category: 'context',
  handler: (args, workspaceRoot) => {
    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      const result = buildFlags(args, routesFlagSchema);
      if (!result.ok) return result.error;
      return runKrolik(`routes ${result.flags}`, projectPath);
    });
  },
};

registerTool(routesTool);
