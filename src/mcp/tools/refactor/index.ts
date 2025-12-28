/**
 * @module mcp/tools/refactor
 * @description krolik_refactor tool - Module structure analysis and refactoring
 */

import {
  buildFlags,
  COMMON_FLAGS,
  type FlagSchema,
  type MCPToolDefinition,
  PROJECT_PROPERTY,
  registerTool,
  runKrolik,
  TIMEOUT_60S,
  withProjectDetection,
} from '../core';

const refactorSchema: FlagSchema = {
  path: COMMON_FLAGS.path,
  package: { flag: '--package', sanitize: 'feature' },
  allPackages: { flag: '--all-packages' },
  quick: { flag: '--quick' },
  deep: { flag: '--deep' },
  dryRun: COMMON_FLAGS.dryRun,
  apply: COMMON_FLAGS.apply,
  fixTypes: { flag: '--fix-types' },
};

export const refactorTool: MCPToolDefinition = {
  name: 'krolik_refactor',
  description: `Analyze and refactor module structure. Finds duplicate functions/types, analyzes structure, suggests migrations.

Modes:
  (default)  Function duplicates + structure (~3s)
  quick      Structure only, no AST parsing (~1.5s)
  deep       Full analysis with types (~30s)`,
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      path: {
        type: 'string',
        description: 'Path to analyze (default: auto-detect)',
      },
      package: {
        type: 'string',
        description: 'Monorepo package to analyze (e.g., web, api)',
      },
      allPackages: {
        type: 'boolean',
        description: 'Analyze all packages in monorepo',
      },
      quick: {
        type: 'boolean',
        description: 'Quick mode: structure only, no AST (~1.5s)',
      },
      deep: {
        type: 'boolean',
        description: 'Deep mode: + types, + git history (~30s)',
      },
      dryRun: {
        type: 'boolean',
        description: 'Show migration plan without applying',
      },
      apply: {
        type: 'boolean',
        description: 'Apply migrations (creates backup, commits first)',
      },
      fixTypes: {
        type: 'boolean',
        description: 'Auto-fix 100% identical type duplicates',
      },
    },
  },
  template: { when: 'Find duplicates/structure', params: '' },
  workflow: { trigger: 'on_refactor', order: 1 },
  category: 'code',
  handler: (args, workspaceRoot) => {
    const result = buildFlags(args, refactorSchema);
    if (!result.ok) {
      // Provide better error message for package name
      if (args.package && result.error.includes('package')) {
        return 'Error: Invalid package name.';
      }
      return result.error;
    }

    // XML is default format (AI-native), no need to add --ai flag
    const flags = result.flags || '';

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`refactor ${flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(refactorTool);
