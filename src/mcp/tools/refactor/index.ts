/**
 * @module mcp/tools/refactor
 * @description krolik_refactor tool - Module structure analysis and refactoring
 *
 * PERFORMANCE: Uses direct imports instead of subprocess.
 * - Default mode for MCP is 'quick' (structure only, no AST)
 * - Fast response due to direct function calls
 */

import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

/**
 * Run lightweight refactor analysis for MCP
 */
async function runLightweightRefactor(
  projectRoot: string,
  options: {
    quick?: boolean;
    deep?: boolean;
    path?: string;
    package?: string;
    allPackages?: boolean;
  },
): Promise<string> {
  // Dynamic imports to avoid loading heavy modules at startup
  const { runRefactor } = await import('@/commands/refactor/runner/analysis');
  const { formatAiNativeXml } = await import('@/commands/refactor/output');

  // Run analysis - default to quick mode for MCP (fastest)
  const analysis = await runRefactor(projectRoot, {
    quick: options.quick ?? !options.deep, // Default to quick unless deep specified
    deep: options.deep,
    path: options.path,
    package: options.package,
    allPackages: options.allPackages,
  });

  // Format as AI-native XML
  return formatAiNativeXml(analysis, projectRoot);
}

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
  handler: async (args, workspaceRoot) => {
    // Resolve project path
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      if (resolved.error.includes('not found')) {
        return `<refactor error="true"><message>Project "${projectArg}" not found.</message></refactor>`;
      }
      return resolved.error;
    }

    // Don't support apply/dryRun/fixTypes in MCP (requires interactive confirmation)
    if (args.apply || args.dryRun || args.fixTypes) {
      return `<refactor error="true">
  <message>Apply/dryRun/fixTypes not supported in MCP mode.</message>
  <hint>Run CLI: krolik refactor --apply</hint>
</refactor>`;
    }

    try {
      const options: {
        quick?: boolean;
        deep?: boolean;
        path?: string;
        package?: string;
        allPackages?: boolean;
      } = {};
      if (typeof args.quick === 'boolean') options.quick = args.quick;
      if (typeof args.deep === 'boolean') options.deep = args.deep;
      if (typeof args.path === 'string') options.path = args.path;
      if (typeof args.package === 'string') options.package = args.package;
      if (typeof args.allPackages === 'boolean') options.allPackages = args.allPackages;

      const xml = await runLightweightRefactor(resolved.path, options);
      return xml;
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(refactorTool);
