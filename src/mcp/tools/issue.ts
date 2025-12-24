/**
 * @module mcp/tools/issue
 * @description krolik_issue tool - GitHub issue parsing
 */

import { buildFlags, type FlagSchema } from './flag-builder';
import { registerTool } from './registry';
import type { MCPToolDefinition } from './types';
import { runKrolik } from './utils';

const issueSchema: FlagSchema = {
  number: { flag: '', sanitize: 'issue', required: true },
};

export const issueTool: MCPToolDefinition = {
  name: 'krolik_issue',
  description: 'Parse a GitHub issue and extract context: checklist, mentioned files, priority.',
  inputSchema: {
    type: 'object',
    properties: {
      number: {
        type: 'string',
        description: 'GitHub issue number',
      },
    },
    required: ['number'],
  },
  handler: (args, projectRoot) => {
    const result = buildFlags(args, issueSchema);
    if (!result.ok) return result.error;

    // For issue command, the number is a positional argument, not a flag
    return runKrolik(`issue ${result.flags}`, projectRoot);
  },
};

registerTool(issueTool);
