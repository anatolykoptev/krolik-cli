/**
 * @module mcp/tools
 * @description MCP tool definitions and implementations
 */

import type { MCPTool } from './types';
import { handlers } from './handlers/index';

// ============================================================================
// SHARED PROPERTIES (Single Source of Truth)
// ============================================================================

/**
 * Common project property for all tools that need project detection
 */
const PROJECT_PROPERTY = {
  project: {
    type: 'string',
    description:
      'Project folder name to analyze (e.g., "piternow-wt-fix", "krolik-cli"). If not specified, auto-detects or returns list of available projects.',
  },
} as const;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Available MCP tools for krolik CLI
 */
export const TOOLS: MCPTool[] = [
  {
    name: 'krolik_status',
    description:
      'Get project diagnostics: git status, typecheck, lint, TODOs. Use this to understand the current state of the project.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROJECT_PROPERTY,
        fast: {
          type: 'boolean',
          description: 'Skip slow checks (typecheck, lint) for faster response',
        },
      },
    },
  },
  {
    name: 'krolik_context',
    description:
      'Generate AI-friendly context for a specific task or feature. Returns structured XML with schema, routes, git info, and approach steps.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROJECT_PROPERTY,
        feature: {
          type: 'string',
          description:
            'The feature or task to analyze (e.g., "booking", "auth", "CRM")',
        },
        issue: {
          type: 'string',
          description: 'GitHub issue number to get context for',
        },
      },
    },
  },
  {
    name: 'krolik_schema',
    description:
      'Analyze Prisma database schema. Returns all models, fields, relations, and enums.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROJECT_PROPERTY,
        json: {
          type: 'boolean',
          description: 'Return JSON format instead of markdown',
        },
      },
    },
  },
  {
    name: 'krolik_routes',
    description:
      'Analyze tRPC API routes. Returns all procedures with types, inputs, and protection status.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROJECT_PROPERTY,
        json: {
          type: 'boolean',
          description: 'Return JSON format instead of markdown',
        },
      },
    },
  },
  {
    name: 'krolik_review',
    description:
      'Review code changes. Analyzes git diff for security issues, performance problems, and risks.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROJECT_PROPERTY,
        staged: {
          type: 'boolean',
          description: 'Review only staged changes',
        },
        pr: {
          type: 'string',
          description: 'Review specific PR number',
        },
      },
    },
  },
  {
    name: 'krolik_issue',
    description:
      'Parse a GitHub issue and extract context: checklist, mentioned files, priority.',
    inputSchema: {
      type: 'object',
      properties: {
        number: {
          type: 'string',
          description: 'GitHub issue number',
        },
      },
      required: ['number'],
    },
  },
  {
    name: 'krolik_audit',
    description:
      'Audit code quality. Analyzes codebase for issues: console.log, any types, complexity, magic numbers, etc. Returns AI-friendly report.',
    inputSchema: {
      type: 'object',
      properties: {
        ...PROJECT_PROPERTY,
        path: {
          type: 'string',
          description: 'Specific subdirectory within project to audit (optional)',
        },
      },
    },
  },
  {
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
        },
        safe: {
          type: 'boolean',
          description: 'Only apply safe fixes (no risky changes)',
        },
      },
    },
  },
];

// ============================================================================
// TOOL EXECUTION
// ============================================================================

/**
 * Run a tool by name with arguments
 *
 * @param name - Tool name (krolik_status, krolik_context, etc.)
 * @param args - Tool arguments
 * @param projectRoot - Project root directory
 * @returns Tool execution result as string
 */
export function runTool(
  name: string,
  args: Record<string, unknown>,
  projectRoot: string,
): string {
  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(args, projectRoot);
}
