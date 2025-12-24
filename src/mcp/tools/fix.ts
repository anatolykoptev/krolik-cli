/**
 * @module mcp/tools/fix
 * @description krolik_fix tool - Auto-fix code quality issues
 */

import { withProjectDetection } from './projects';
import { registerTool } from './registry';
import { PROJECT_PROPERTY } from './shared';
import type { MCPToolDefinition } from './types';
import { escapeShellArg, runKrolik, sanitizeFeatureName, TIMEOUT_60S } from './utils';

const VALID_CATEGORIES = ['lint', 'type-safety', 'complexity', 'hardcoded', 'srp'];

export const fixTool: MCPToolDefinition = {
  name: 'krolik_fix',
  description:
    'Auto-fix code quality issues. Removes console.log, debugger, replaces any with unknown, etc. Use --dry-run to preview.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      dryRun: {
        type: 'boolean',
        description: 'Preview changes without applying (recommended first)',
      },
      path: {
        type: 'string',
        description: 'Specific directory to fix (optional)',
      },
      category: {
        type: 'string',
        description: 'Fix category: lint, type-safety, complexity, hardcoded, srp',
      },
      safe: {
        type: 'boolean',
        description: 'Only apply safe fixes (no risky changes)',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    const flagParts: string[] = [];

    if (args.dryRun) {
      flagParts.push('--dry-run');
    }

    if (args.safe) {
      flagParts.push('--safe');
    }

    if (args.path) {
      const pathVal = sanitizeFeatureName(args.path);
      if (!pathVal) {
        return 'Error: Invalid path. Only alphanumeric, hyphens, underscores, dots allowed.';
      }
      flagParts.push(`--path=${escapeShellArg(pathVal)}`);
    }

    if (args.category) {
      if (typeof args.category !== 'string' || !VALID_CATEGORIES.includes(args.category)) {
        return `Error: Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`;
      }
      flagParts.push(`--category=${args.category}`);
    }

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`fix ${flagParts.join(' ')}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(fixTool);
