/**
 * @module mcp/tools/routes
 * @description krolik_routes tool - tRPC routes analysis
 *
 * PERFORMANCE: Uses direct function imports instead of subprocess spawn.
 * This eliminates 10s+ Node.js startup overhead.
 */

import { analyzeRoutes } from '@/commands/routes';
import { formatAI, formatCompact, formatJson, formatSmart } from '@/commands/routes/output';
import { findRoutersDir } from '@/lib/@discovery/routes';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

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
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      if (resolved.error.includes('not found')) {
        return `<routes error="true"><message>Project "${projectArg}" not found.</message></routes>`;
      }
      return resolved.error;
    }

    try {
      // Find routers directory
      const routersDir = findRoutersDir(resolved.path);

      if (!routersDir) {
        return `<routes error="true">
  <message>tRPC routers directory not found</message>
  <hint>Checked: packages/api/src/routers, src/server/routers, src/routers</hint>
</routes>`;
      }

      // Analyze routes
      const result = analyzeRoutes(routersDir);

      // Format output based on options
      if (args.json === true) {
        return formatJson(result);
      }

      if (args.compact === true) {
        return formatCompact(result);
      }

      if (args.full === true) {
        return formatAI(result);
      }

      // Default: Smart format
      return formatSmart(result);
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(routesTool);
