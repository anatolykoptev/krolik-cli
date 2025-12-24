/**
 * @module mcp/tools/audit
 * @description krolik_audit tool - Code quality audit
 */

import { buildFlags, type FlagSchema } from './flag-builder';
import { withProjectDetection } from './projects';
import { registerTool } from './registry';
import { COMMON_FLAGS, PROJECT_PROPERTY } from './shared';
import type { MCPToolDefinition } from './types';
import { runKrolik, TIMEOUT_60S } from './utils';

const auditSchema: FlagSchema = {
  path: COMMON_FLAGS.path,
};

export const auditTool: MCPToolDefinition = {
  name: 'krolik_audit',
  description:
    'Audit code quality. Analyzes codebase for issues: console.log, any types, complexity, magic numbers, etc. Returns AI-friendly report.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      path: {
        type: 'string',
        description: 'Specific subdirectory within project to audit (optional)',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    const result = buildFlags(args, auditSchema);
    if (!result.ok) return result.error;

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`audit ${result.flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(auditTool);
