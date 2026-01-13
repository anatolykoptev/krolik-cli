/**
 * @module mcp/tools/audit
 * @description krolik_audit tool - Code quality audit
 *
 * PERFORMANCE: Uses direct function imports instead of subprocess spawn.
 * This eliminates 10s+ Node.js startup overhead.
 *
 * Supports two modes:
 * - Standard audit (mode: all, release, lint, etc) - lint-style issues
 * - Refactor mode (mode: refactor) - redirects to krolik_refactor tool
 */

import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
import { formatError } from '../core/errors';
import { resolveProjectPath } from '../core/projects';

// Valid audit modes
const VALID_MODES = [
  'all',
  'release',
  'refactor',
  'hardcoded',
  'lint',
  'types',
  'security',
  'pre-commit',
  'queries',
] as const;

type AuditMode = (typeof VALID_MODES)[number];

/**
 * Generate audit report directly (no subprocess)
 */
async function generateAuditReport(
  projectRoot: string,
  options: { feature?: string; mode?: AuditMode },
): Promise<string> {
  const { generateAIReportFromAnalysis, formatAsXml } = await import('@/lib/@reporter');
  const { parseIntent, filterByIntent } = await import('@/commands/audit/filters');

  // Generate full report
  const report = await generateAIReportFromAnalysis(projectRoot);

  // Apply intent filter if specified
  const intent = parseIntent({ feature: options.feature, mode: options.mode });
  if (intent) {
    // Filter the report based on intent
    const filterReport = (report: Awaited<ReturnType<typeof generateAIReportFromAnalysis>>) => {
      const filteredGroups = report.groups
        .map((group) => {
          const qualityIssues = group.issues.map((ei) => ei.issue);
          const filtered = filterByIntent(qualityIssues, intent);
          const filteredFiles = new Set(filtered.map((i) => `${i.file}:${i.line}`));
          const filteredIssues = group.issues.filter((ei) =>
            filteredFiles.has(`${ei.issue.file}:${ei.issue.line}`),
          );
          if (filteredIssues.length === 0) return null;
          return {
            ...group,
            issues: filteredIssues,
            count: filteredIssues.length,
            autoFixableCount: filteredIssues.filter((i) => i.autoFixable).length,
          };
        })
        .filter((g): g is NonNullable<typeof g> => g !== null);

      const totalIssues = filteredGroups.reduce((sum, g) => sum + g.count, 0);
      const autoFixableIssues = filteredGroups.reduce((sum, g) => sum + g.autoFixableCount, 0);

      // Recalculate byPriority
      const byPriority: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
      for (const group of filteredGroups) {
        for (const issue of group.issues) {
          byPriority[issue.priority] = (byPriority[issue.priority] ?? 0) + 1;
        }
      }

      return {
        ...report,
        groups: filteredGroups,
        quickWins: report.quickWins.filter((qw) =>
          filteredGroups.some((g) =>
            g.issues.some((i) => i.issue.file === qw.issue.file && i.issue.line === qw.issue.line),
          ),
        ),
        hotspots: report.hotspots.filter((h) =>
          filteredGroups.some((g) => g.issues.some((i) => i.issue.file === h.file)),
        ),
        actionPlan: report.actionPlan.filter((step) =>
          filteredGroups.some((g) => g.issues.some((i) => i.issue.file === step.file)),
        ),
        summary: {
          ...report.summary,
          totalIssues,
          autoFixableIssues,
          manualIssues: totalIssues - autoFixableIssues,
          byPriority: byPriority as typeof report.summary.byPriority,
        },
      };
    };

    return formatAsXml(filterReport(report));
  }

  return formatAsXml(report);
}

export const auditTool: MCPToolDefinition = {
  name: 'krolik_audit',
  description: `Audit code quality. Analyzes codebase for issues: console.log, any types, complexity, magic numbers, etc. Returns AI-friendly report.

Modes:
- all (default): All issues
- release: Security + type-safety (pre-release check)
- refactor: Module structure - duplicates, migrations
- hardcoded: Strings, magic numbers, URLs
- lint: Console.log, debugger, alert (100% auto-fixable)
- types: Type-safety issues (any, ts-ignore)
- security: Security vulnerabilities only
- pre-commit: lint + security + types (before commit)
- queries: Duplicate Prisma/tRPC queries that could be consolidated`,
  inputSchema: {
    type: 'object',
    properties: {
      ...PROJECT_PROPERTY,
      path: {
        type: 'string',
        description: 'Specific subdirectory within project to audit (optional)',
      },
      feature: {
        type: 'string',
        description: 'Filter to specific feature/domain (e.g., "booking", "auth")',
      },
      mode: {
        type: 'string',
        enum: VALID_MODES as unknown as string[],
        description:
          'Filter by mode: all, release, refactor (runs refactor cmd), hardcoded, lint (auto-fixable), types, security, pre-commit, queries (duplicate queries)',
      },
      // Refactor-specific options (only used when mode=refactor)
      package: {
        type: 'string',
        description: 'Monorepo package to analyze (e.g., web, api) - only for mode=refactor',
      },
      allPackages: {
        type: 'boolean',
        description: 'Analyze all packages in monorepo - only for mode=refactor',
      },
      quick: {
        type: 'boolean',
        description: 'Quick mode: structure only, no AST (~1.5s) - only for mode=refactor',
      },
      deep: {
        type: 'boolean',
        description: 'Deep mode: + types, + git history (~30s) - only for mode=refactor',
      },
      dryRun: {
        type: 'boolean',
        description: 'Show migration plan without applying - only for mode=refactor',
      },
      apply: {
        type: 'boolean',
        description: 'Apply migrations (creates backup, commits first) - only for mode=refactor',
      },
      fixTypes: {
        type: 'boolean',
        description: 'Auto-fix 100% identical type duplicates - only for mode=refactor',
      },
    },
  },
  template: { when: 'Code quality audit', params: '—' },
  workflow: { trigger: 'on_refactor', order: 2 },
  category: 'code',
  handler: async (args, workspaceRoot) => {
    const mode = args.mode as AuditMode | undefined;

    // When mode=refactor, tell user to use krolik_refactor tool
    if (mode === 'refactor') {
      return '<audit error="true"><message>For refactor analysis, use krolik_refactor tool instead.</message></audit>';
    }

    // Resolve project path
    const projectArg = typeof args.project === 'string' ? args.project : undefined;
    const resolved = resolveProjectPath(workspaceRoot, projectArg);

    if ('error' in resolved) {
      if (resolved.error.includes('not found')) {
        return `<audit error="true"><message>Project "${projectArg}" not found.</message></audit>`;
      }
      return resolved.error;
    }

    try {
      const options: { feature?: string; mode?: AuditMode } = {};
      if (typeof args.feature === 'string') options.feature = args.feature;
      if (mode) options.mode = mode;
      const xml = await generateAuditReport(resolved.path, options);
      return xml;
    } catch (error) {
      return formatError(error);
    }
  },
};

registerTool(auditTool);
