/**
 * @module mcp/tools/audit
 * @description krolik_audit tool - Code quality audit
 */

import { withProjectDetection } from './projects';
import { registerTool } from './registry';
import { PROJECT_PROPERTY } from './shared';
import type { MCPToolDefinition } from './types';
import { escapeShellArg, runKrolik, sanitizeFeatureName, TIMEOUT_60S } from './utils';

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
    const flagParts: string[] = [];

    if (args.path) {
      const pathVal = sanitizeFeatureName(args.path);
      if (!pathVal) {
        return 'Error: Invalid path. Only alphanumeric, hyphens, underscores, dots allowed.';
      }
      flagParts.push(`--path=${escapeShellArg(pathVal)}`);
    }

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`audit ${flagParts.join(' ')}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(auditTool);
