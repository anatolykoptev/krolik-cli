/**
 * @module mcp/tools/audit
 * @description krolik_audit tool - Code quality audit
 *
 * Supports two modes:
 * - Standard audit (mode: all, release) - lint-style issues
 * - Refactor mode (mode: refactor) - duplicate detection, structure analysis
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
  TIMEOUT_120S,
  withProjectDetection,
} from '../core';

// Schema for standard audit modes
const auditSchema: FlagSchema = {
  path: COMMON_FLAGS.path,
  feature: COMMON_FLAGS.feature,
  mode: { flag: '--mode' },
};

// Schema for refactor mode
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
        enum: [
          'all',
          'release',
          'refactor',
          'hardcoded',
          'lint',
          'types',
          'security',
          'pre-commit',
          'queries',
        ],
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
  handler: (args, workspaceRoot) => {
    const mode = args.mode as string | undefined;

    // When mode=refactor, run the refactor command instead
    if (mode === 'refactor') {
      const result = buildFlags(args, refactorSchema);
      if (!result.ok) {
        if (args.package && result.error.includes('package')) {
          return 'Error: Invalid package name.';
        }
        return result.error;
      }

      return withProjectDetection(args, workspaceRoot, (projectPath) => {
        return runKrolik(`refactor ${result.flags || ''}`, projectPath, TIMEOUT_120S);
      });
    }

    // Standard audit for other modes
    const result = buildFlags(args, auditSchema);
    if (!result.ok) return result.error;

    return withProjectDetection(args, workspaceRoot, (projectPath) => {
      return runKrolik(`audit ${result.flags}`, projectPath, TIMEOUT_60S);
    });
  },
};

registerTool(auditTool);
