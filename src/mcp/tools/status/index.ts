/**
 * @module mcp/tools/status
 * @description krolik_status tool - Project diagnostics
 *
 * PERFORMANCE: Uses direct function imports instead of subprocess spawn.
 * This eliminates 10s+ Node.js startup overhead.
 */

import { getProjectStatus } from '@/commands/status';
import { formatAI } from '@/commands/status/output';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

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
  template: { when: 'Session start', params: '`fast: true`' },
  workflow: { trigger: 'session_start', order: 1 },
  category: 'start',
  handler: (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      if (resolved.error.includes('not found')) {
        return `<status error="true"><message>Project "${projectArg}" not found.</message></status>`;
      }
      return resolved.error;
    }

    try {
      const status = getProjectStatus(resolved.path, {
        fast: args.fast === true,
      });
      return formatAI(status);
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(statusTool);
