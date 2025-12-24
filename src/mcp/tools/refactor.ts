/**
 * @module mcp/tools/refactor
 * @description krolik_refactor tool - Module structure analysis and refactoring
 */

import { withProjectDetection } from './projects';
import { registerTool } from './registry';
import { PROJECT_PROPERTY } from './shared';
import type { MCPToolDefinition } from './types';
import { escapeShellArg, runKrolik, sanitizeFeatureName, TIMEOUT_60S } from './utils';

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
    const flagParts: string[] = [];

    if (args.path) {
      const pathVal = sanitizeFeatureName(args.path);
      if (!pathVal) {
        return 'Error: Invalid path. Only alphanumeric, hyphens, underscores, dots allowed.';
      }
      flagParts.push(`--path=${escapeShellArg(pathVal)}`);
    }

    if (args.package) {
      const pkgVal = sanitizeFeatureName(args.package);
      if (!pkgVal) {
        return 'Error: Invalid package name.';
      }
      flagParts.push(`--package=${escapeShellArg(pkgVal)}`);
    }

    if (args.allPackages) flagParts.push('--all-packages');
    if (args.duplicatesOnly) flagParts.push('--duplicates-only');
    if (args.typesOnly) flagParts.push('--types-only');
    if (args.includeTypes) flagParts.push('--include-types');
    if (args.structureOnly) flagParts.push('--structure-only');
    if (args.dryRun) flagParts.push('--dry-run');
    if (args.apply) flagParts.push('--apply');
    if (args.fixTypes) flagParts.push('--fix-types');

    // Always use AI-native output for MCP
    flagParts.push('--ai');

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`refactor ${flagParts.join(' ')}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(refactorTool);
