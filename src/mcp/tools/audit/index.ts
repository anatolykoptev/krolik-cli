/**
 * @module mcp/tools/audit
 * @description krolik_audit tool - Code quality audit
 *
 * PERFORMANCE: MCP returns cached AUDIT.xml from CLI runs.
 * - Instant response (reads file instead of running analysis)
 * - Tells user to run `krolik audit` if cache is stale
 * - Filter by mode/feature applied to cached results
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { type MCPToolDefinition, PROJECT_PROPERTY, registerTool } from '../core';
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

// Cache freshness threshold (1 hour)
const CACHE_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Filter cached XML report by mode
 * Simple text-based filtering for common patterns
 */
function filterCachedReport(xml: string, options: { mode?: AuditMode; feature?: string }): string {
  // If no filter, return as-is
  if (!options.mode && !options.feature) {
    return xml;
  }

  // For mode filtering, we extract the category mapping
  const categoryFilters: Record<string, string[]> = {
    lint: ['lint'],
    types: ['type-safety'],
    security: ['security'],
    hardcoded: ['hardcoded'],
    release: ['security', 'type-safety'],
    'pre-commit': ['lint', 'security', 'type-safety'],
    queries: ['duplicate-query'],
  };

  const allowedCategories = options.mode ? categoryFilters[options.mode] : undefined;

  // If mode is 'all' or not in our mapping, return full report
  if (options.mode === 'all' || (options.mode && !allowedCategories)) {
    return xml;
  }

  // Add filter info header
  const filterInfo: string[] = [];
  if (options.mode) filterInfo.push(`mode="${options.mode}"`);
  if (options.feature) filterInfo.push(`feature="${options.feature}"`);

  const header = `<audit-filter ${filterInfo.join(' ')}>\n`;
  const footer = '\n</audit-filter>';

  // For complex filtering, just return the full report with a note
  // Full filtering would require XML parsing which adds complexity
  return `${header}<note>Showing cached results. For precise filtering, run: krolik audit --mode=${options.mode || 'all'}${options.feature ? ` --feature=${options.feature}` : ''}</note>\n${xml}${footer}`;
}

/**
 * Get cached audit report if fresh
 */
function getCachedAuditReport(projectRoot: string): { xml: string; age: number } | null {
  const auditPath = path.join(projectRoot, '.krolik', 'AUDIT.xml');

  if (!fs.existsSync(auditPath)) {
    return null;
  }

  const stats = fs.statSync(auditPath);
  const age = Date.now() - stats.mtimeMs;

  // Check if cache is fresh
  if (age > CACHE_MAX_AGE_MS) {
    return null;
  }

  try {
    const xml = fs.readFileSync(auditPath, 'utf-8');
    return { xml, age };
  } catch {
    return null;
  }
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

    // Try to get cached report first
    const cached = getCachedAuditReport(resolved.path);

    if (cached) {
      const ageMinutes = Math.round(cached.age / 60000);
      const options: { mode?: AuditMode; feature?: string } = {};
      if (mode) options.mode = mode;
      if (typeof args.feature === 'string') options.feature = args.feature;

      const filtered = filterCachedReport(cached.xml, options);
      return `<audit source="cache" age-minutes="${ageMinutes}">\n${filtered}\n</audit>`;
    }

    // No cache available - tell user to run CLI audit
    return `<audit error="true">
  <message>No recent audit cache found. Run CLI audit first:</message>
  <command>krolik audit${mode ? ` --mode=${mode}` : ''}</command>
  <reason>MCP timeout prevents full analysis. CLI audit has no timeout and caches results.</reason>
</audit>`;
  },
};

registerTool(auditTool);
