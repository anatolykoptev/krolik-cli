/**
 * @module mcp/tools/fix
 * @description krolik_fix tool - Auto-fix code quality issues
 *
 * PERFORMANCE: Uses direct imports instead of subprocess.
 * - Generates fix plan with direct function calls
 * - Returns AI-friendly XML format
 * - Does NOT apply fixes (use CLI for that)
 */

import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';
import { FIX_CATEGORIES } from '../core/shared';

type FixCategory = (typeof FIX_CATEGORIES)[number];

/**
 * Run lightweight fix plan generation for MCP
 *
 * Generates fix plan without applying changes.
 * MCP mode is read-only - use CLI for actual fixes.
 */
async function runLightweightFix(
  projectRoot: string,
  options: {
    dryRun?: boolean;
    path?: string;
    category?: FixCategory;
    safe?: boolean;
  },
): Promise<string> {
  // Dynamic imports to avoid loading heavy modules at startup
  const { generateFixPlan } = await import('@/commands/fix/plan');
  const { formatPlanForAI } = await import('@/commands/fix/formatters');
  const { registry } = await import('@/commands/fix/fixers');

  type FixerContext = { projectRoot: string; dryRun: boolean; totalIssues: number };

  // Initialize fixers (lifecycle: onStart)
  const allFixers = registry.all();
  const initContext: FixerContext = {
    projectRoot,
    dryRun: true, // MCP is always dry-run
    totalIssues: 0,
  };

  for (const fixer of allFixers) {
    if (fixer.onStart) {
      await fixer.onStart(initContext);
    }
  }

  // Generate fix plan
  const fixOptions: Parameters<typeof generateFixPlan>[1] = {
    dryRun: true, // Always dry-run in MCP
  };
  if (options.path) fixOptions.path = options.path;
  if (options.category) fixOptions.category = options.category;
  if (options.safe) fixOptions.safe = options.safe;

  const planResult = await generateFixPlan(projectRoot, fixOptions);
  const { plans, skipStats, totalIssues, recommendations } = planResult;

  // Call onComplete lifecycle hooks
  const totalFixes = plans.reduce((sum, p) => sum + p.fixes.length, 0);
  const completeContext: FixerContext = {
    projectRoot,
    dryRun: true,
    totalIssues: totalFixes,
  };

  for (const fixer of allFixers) {
    if (fixer.onComplete) {
      await fixer.onComplete(completeContext);
    }
  }

  // Format as AI-friendly XML
  const xml = formatPlanForAI(plans, skipStats, totalIssues, recommendations);

  // Add MCP hint if there are fixes available
  if (totalFixes > 0) {
    return `${xml}
<mcp-hint>
  <message>MCP mode is read-only. Use CLI to apply fixes:</message>
  <command>krolik fix --yes${options.category ? ` --category=${options.category}` : ''}${options.path ? ` --path=${options.path}` : ''}</command>
</mcp-hint>`;
  }

  return xml;
}

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
  template: { when: 'Quality issues found', params: '`dryRun: true` first' },
  workflow: { trigger: 'after_code', order: 1 },
  category: 'code',
  handler: async (args, workspaceRoot) => {
    // Resolve project path
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      if (resolved.error.includes('not found')) {
        return `<fix error="true"><message>Project "${projectArg}" not found.</message></fix>`;
      }
      return resolved.error;
    }

    // Validate category if provided
    if (args.category && !FIX_CATEGORIES.includes(args.category as FixCategory)) {
      return `<fix error="true"><message>Invalid category. Must be one of: ${FIX_CATEGORIES.join(', ')}</message></fix>`;
    }

    try {
      const options: Parameters<typeof runLightweightFix>[1] = {};
      if (typeof args.dryRun === 'boolean') options.dryRun = args.dryRun;
      if (typeof args.path === 'string') options.path = args.path;
      if (typeof args.category === 'string') options.category = args.category as FixCategory;
      if (typeof args.safe === 'boolean') options.safe = args.safe;

      const xml = await runLightweightFix(resolved.path, options);
      return xml;
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(fixTool);
