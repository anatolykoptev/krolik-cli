/**
 * @module mcp/tools/issue
 * @description krolik_issue tool - GitHub issue parsing
 */

import { registerTool } from './registry';
import type { MCPToolDefinition } from './types';
import { runKrolik, sanitizeIssueNumber } from './utils';

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
    const issueNum = sanitizeIssueNumber(args.number);
    if (!issueNum) {
      return 'Error: Invalid issue number. Must be a positive integer.';
    }

    return runKrolik(`issue ${issueNum}`, projectRoot);
  },
};

registerTool(issueTool);
