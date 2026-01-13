/**
 * @module mcp/tools/progress
 * @description krolik_progress tool - Task/epic progress tracking
 *
 * PERFORMANCE: Uses direct function imports instead of subprocess spawn.
 * This eliminates 10s+ Node.js startup overhead.
 */

import { getProgress, type ProgressOptions } from '@/commands/progress';
import { formatProgressContext } from '@/lib/@storage/progress';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

export const progressTool: MCPToolDefinition = {
  name: 'krolik_progress',
  description:
    'Task/epic progress tracking. Shows current tasks, epics, session info, and suggestions. Use --sync to sync with GitHub issues first.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      sync: {
        type: 'boolean',
        description: 'Sync with GitHub issues before showing progress',
      },
    },
  },
  template: { when: 'Need progress overview', params: '' },
  category: 'start',
  handler: (args, workspaceRoot) => {
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      return resolved.error;
    }

    try {
      const projectName = resolved.path.split('/').pop() ?? 'unknown';
      const options: ProgressOptions = {
        sync: args.sync === true,
        format: 'ai',
      };

      // Call getProgress to trigger sync if requested
      getProgress(projectName, options);

      // Return AI-friendly format
      return formatProgressContext(projectName);
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(progressTool);
