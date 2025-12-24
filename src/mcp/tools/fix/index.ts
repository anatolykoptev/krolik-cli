/**
 * @module mcp/tools/fix
 * @description krolik_fix tool - Auto-fix code quality issues
 */

import {
  buildFlags,
  COMMON_FLAGS,
  FIX_CATEGORIES,
  type FlagSchema,
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  runKrolik,
  TIMEOUT_60S,
  withProjectDetection,
} from '../core';

const fixSchema: FlagSchema = {
  dryRun: COMMON_FLAGS.dryRun,
  safe: COMMON_FLAGS.safe,
  path: COMMON_FLAGS.path,
  category: {
    flag: '--category',
    validate: (val) =>
      typeof val === 'string' && FIX_CATEGORIES.includes(val as (typeof FIX_CATEGORIES)[number]),
  },
};

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
        enum: [...FIX_CATEGORIES],
      },
      safe: {
        type: 'boolean',
        description: 'Only apply safe fixes (no risky changes)',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    const result = buildFlags(args, fixSchema);
    if (!result.ok) {
      // Provide better error message for category validation
      if (
        args.category &&
        !FIX_CATEGORIES.includes(args.category as (typeof FIX_CATEGORIES)[number])
      ) {
        return `Error: Invalid category. Must be one of: ${FIX_CATEGORIES.join(', ')}`;
      }
      return result.error;
    }

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`fix ${result.flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(fixTool);
