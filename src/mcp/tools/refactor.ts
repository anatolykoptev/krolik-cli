/**
 * @module mcp/tools/refactor
 * @description krolik_refactor tool - Module structure analysis and refactoring
 */

import { buildFlags, type FlagSchema } from './flag-builder';
import { withProjectDetection } from './projects';
import { registerTool } from './registry';
import { COMMON_FLAGS, PROJECT_PROPERTY } from './shared';
import type { MCPToolDefinition } from './types';
import { runKrolik, TIMEOUT_60S } from './utils';

const refactorSchema: FlagSchema = {
  path: COMMON_FLAGS.path,
  package: { flag: '--package', sanitize: 'feature' },
  allPackages: { flag: '--all-packages' },
  duplicatesOnly: { flag: '--duplicates-only' },
  typesOnly: { flag: '--types-only' },
  includeTypes: { flag: '--include-types' },
  structureOnly: { flag: '--structure-only' },
  dryRun: COMMON_FLAGS.dryRun,
  apply: COMMON_FLAGS.apply,
  fixTypes: { flag: '--fix-types' },
};

export const refactorTool: MCPToolDefinition = {
  name: 'krolik_refactor',
  description:
    'Analyze and refactor module structure. Finds duplicate functions/types, analyzes structure, suggests migrations.',
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      path: {
        type: 'string',
        description: 'Path to analyze (default: auto-detect for monorepo)',
      },
      package: {
        type: 'string',
        description: 'Monorepo package to analyze (e.g., web, api)',
      },
      allPackages: {
        type: 'boolean',
        description: 'Analyze all packages in monorepo',
      },
      duplicatesOnly: {
        type: 'boolean',
        description: 'Only analyze duplicate functions',
      },
      typesOnly: {
        type: 'boolean',
        description: 'Only analyze duplicate types/interfaces',
      },
      includeTypes: {
        type: 'boolean',
        description: 'Include type/interface duplicate detection',
      },
      structureOnly: {
        type: 'boolean',
        description: 'Only analyze module structure',
      },
      dryRun: {
        type: 'boolean',
        description: 'Show migration plan without applying',
      },
      apply: {
        type: 'boolean',
        description: 'Apply migrations (move files, update imports)',
      },
      fixTypes: {
        type: 'boolean',
        description: 'Auto-fix type duplicates (merge identical types)',
      },
    },
  },
  handler: (args, workspaceRoot) => {
    const result = buildFlags(args, refactorSchema);
    if (!result.ok) {
      // Provide better error message for package name
      if (args.package && result.error.includes('package')) {
        return 'Error: Invalid package name.';
      }
      return result.error;
    }

    // Always use AI-native output for MCP
    const flags = result.flags ? `${result.flags} --ai` : '--ai';

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`refactor ${flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(refactorTool);
