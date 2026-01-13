/**
 * @module mcp/tools/refactor
 * @description krolik_refactor tool - Module structure analysis and refactoring
 *
 * PERFORMANCE: Uses direct imports instead of subprocess.
 * - Default mode is 'default' (duplicates + structure + all analyses)
 * - Use 'quick' flag for faster structure-only analysis
 * - Use 'deep' flag for full analysis with git history
 */

import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

type RefactorMode = 'quick' | 'default' | 'deep';

/**
 * Run lightweight refactor analysis for MCP using registry-based system
 */
async function runLightweightRefactor(
  projectRoot: string,
  options: {
    mode?: RefactorMode;
    path?: string;
    package?: string;
    allPackages?: boolean;
  },
): Promise<string> {
  // Dynamic imports to avoid loading heavy modules at startup
  const { runRefactor } = await import('@/commands/refactor/runner/analysis');
  const { runRegistryAnalysis } = await import('@/commands/refactor/runner/registry-runner');
  const { resolvePaths } = await import('@/commands/refactor/paths');

  // Default to 'default' mode for MCP (full analysis)
  const mode: RefactorMode = options.mode ?? 'default';

  // Build options object (only include defined values)
  const refactorOptions: Parameters<typeof runRefactor>[1] = { mode };
  if (options.path) refactorOptions.path = options.path;
  if (options.package) refactorOptions.package = options.package;
  if (options.allPackages !== undefined) refactorOptions.allPackages = options.allPackages;

  // Run base analysis
  const analysis = await runRefactor(projectRoot, refactorOptions);

  // Resolve target path for registry analysis
  const resolved = resolvePaths(projectRoot, options);
  const targetPath = resolved.targetPaths[0] ?? projectRoot;

  // Map mode to output level (summary | standard | full)
  const outputLevel = mode === 'quick' ? 'summary' : mode === 'deep' ? 'full' : 'standard';

  // Run registry-based analysis (returns XML output directly)
  const result = await runRegistryAnalysis({
    projectRoot,
    targetPath,
    baseAnalysis: analysis,
    outputLevel,
  });

  return result.output;
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
      // Resolve mode from quick/deep boolean flags
      let mode: RefactorMode = 'default'; // Default mode with full analysis
      if (args.deep === true) {
        mode = 'deep';
      } else if (args.quick === true) {
        mode = 'quick';
      }

      const options: Parameters<typeof runLightweightRefactor>[1] = { mode };
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
