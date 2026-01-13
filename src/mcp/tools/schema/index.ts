/**
 * @module mcp/tools/schema
 * @description krolik_schema tool - Prisma schema analysis
 *
 * PERFORMANCE: Uses direct function imports instead of subprocess spawn.
 * This eliminates 10s+ Node.js startup overhead.
 */

import { analyzeSchema, filterSchema, type SchemaOptions } from '@/commands/schema';
import {
  formatAI,
  formatCompact,
  formatJson,
  formatSmart,
  type SchemaOutput,
} from '@/commands/schema/output';
import { findSchemaDir } from '@/lib/@discovery/schema';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

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
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      if (resolved.error.includes('not found')) {
        return `<schema error="true"><message>Project "${projectArg}" not found.</message></schema>`;
      }
      return resolved.error;
    }

    try {
      // Find schema directory
      const schemaDir = findSchemaDir(resolved.path);

      if (!schemaDir) {
        return `<schema error="true">
  <message>Prisma schema directory not found</message>
  <hint>Checked: prisma, packages/db/prisma, src/prisma, db/prisma</hint>
</schema>`;
      }

      // Analyze schema
      const fullResult = analyzeSchema(schemaDir);

      // Build filter options
      const filterOptions: SchemaOptions = {
        model: typeof args.model === 'string' ? args.model : undefined,
        domain: typeof args.domain === 'string' ? args.domain : undefined,
      };

      // Apply filters if specified
      const hasFilters = filterOptions.model || filterOptions.domain;
      const result: SchemaOutput = hasFilters
        ? filterSchema(fullResult, filterOptions)
        : fullResult;

      // Format output based on options
      if (args.json === true) {
        return formatJson(result);
      }

      if (args.compact === true) {
        return formatCompact(result, fullResult);
      }

      if (args.full === true) {
        return hasFilters ? formatAI(result) : formatAI(fullResult);
      }

      // Default: Smart format
      return formatSmart(result, hasFilters ? fullResult : undefined);
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(schemaTool);
