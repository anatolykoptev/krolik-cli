/**
 * @module mcp/tools
 * @description MCP tool definitions and implementations
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import type { MCPTool } from './types';

// Get the path to the CLI script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../bin/cli.js');

// ============================================================================
// CONSTANTS
// ============================================================================

const TIMEOUT_60S = 60000;

// ============================================================================
// INPUT SANITIZATION (Security: prevent command injection)
// ============================================================================

/**
 * Validate and sanitize a feature/task name
 * Only allows alphanumeric, hyphens, underscores, and dots
 */
function sanitizeFeatureName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const sanitized = input.trim();
  if (sanitized.length === 0 || sanitized.length > 100) return null;
  // Only allow safe characters: alphanumeric, hyphen, underscore, dot, space
  if (!/^[a-zA-Z0-9_\-.\s]+$/.test(sanitized)) return null;
  return sanitized;
}

/**
 * Validate and sanitize an issue/PR number
 * Only allows positive integers
 */
function sanitizeIssueNumber(input: unknown): number | null {
  if (typeof input === 'number') {
    if (Number.isInteger(input) && input > 0 && input < 1000000) return input;
    return null;
  }
  if (typeof input === 'string') {
    const num = parseInt(input, 10);
    if (Number.isNaN(num) || num <= 0 || num >= 1000000) return null;
    // Ensure string only contained digits
    if (!/^\d+$/.test(input.trim())) return null;
    return num;
  }
  return null;
}

/**
 * Escape shell argument for safe use in commands
 */
function escapeShellArg(arg: string): string {
  // Replace single quotes with escaped version and wrap in single quotes
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

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
        path: {
          type: 'string',
          description: 'Specific directory to audit (optional)',
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
 * Execute krolik CLI command
 */
function runKrolik(args: string, projectRoot: string, timeout = 30000): string {
  try {
    // Use node with absolute path to CLI instead of npx (package not published)
    const output = execSync(`node "${CLI_PATH}" ${args}`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output;
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    return err.stdout || err.stderr || err.message || 'Unknown error';
  }
}

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
  switch (name) {
    case 'krolik_status': {
      const flags = args.fast ? '--fast' : '';
      return runKrolik(`status ${flags}`, projectRoot);
    }

    case 'krolik_context': {
      const flagParts: string[] = []; // Don't use --full by default (too slow)
      // Security: Validate and sanitize feature name
      if (args.feature) {
        const feature = sanitizeFeatureName(args.feature);
        if (!feature) {
          return 'Error: Invalid feature name. Only alphanumeric, hyphens, underscores allowed.';
        }
        flagParts.push(`--feature=${escapeShellArg(feature)}`);
      }
      // Security: Validate issue number
      if (args.issue) {
        const issue = sanitizeIssueNumber(args.issue);
        if (!issue) {
          return 'Error: Invalid issue number. Must be a positive integer.';
        }
        flagParts.push(`--issue=${issue}`);
      }
      return runKrolik(`context ${flagParts.join(' ')}`, projectRoot, TIMEOUT_60S);
    }

    case 'krolik_schema': {
      const flags = args.json ? '--json' : '';
      return runKrolik(`schema ${flags}`, projectRoot);
    }

    case 'krolik_routes': {
      const flags = args.json ? '--json' : '';
      return runKrolik(`routes ${flags}`, projectRoot);
    }

    case 'krolik_review': {
      let flags = '';
      if (args.staged) flags += ' --staged';
      // Security: Validate PR number
      if (args.pr) {
        const pr = sanitizeIssueNumber(args.pr);
        if (!pr) {
          return 'Error: Invalid PR number. Must be a positive integer.';
        }
        flags += ` --pr=${pr}`;
      }
      return runKrolik(`review ${flags}`, projectRoot, TIMEOUT_60S);
    }

    case 'krolik_issue': {
      // Security: Validate issue number (required field)
      const issueNum = sanitizeIssueNumber(args.number);
      if (!issueNum) {
        return 'Error: Invalid issue number. Must be a positive integer.';
      }
      return runKrolik(`issue ${issueNum}`, projectRoot);
    }

    case 'krolik_audit': {
      const flagParts: string[] = [];
      // Security: Validate path
      if (args.path) {
        const pathVal = sanitizeFeatureName(args.path);
        if (!pathVal) {
          return 'Error: Invalid path. Only alphanumeric, hyphens, underscores, dots allowed.';
        }
        flagParts.push(`--path=${escapeShellArg(pathVal)}`);
      }
      return runKrolik(`audit ${flagParts.join(' ')}`, projectRoot, TIMEOUT_60S);
    }

    case 'krolik_fix': {
      const flagParts: string[] = [];
      if (args.dryRun) {
        flagParts.push('--dry-run');
      }
      if (args.safe) {
        flagParts.push('--safe');
      }
      // Security: Validate path
      if (args.path) {
        const pathVal = sanitizeFeatureName(args.path);
        if (!pathVal) {
          return 'Error: Invalid path. Only alphanumeric, hyphens, underscores, dots allowed.';
        }
        flagParts.push(`--path=${escapeShellArg(pathVal)}`);
      }
      // Security: Validate category
      if (args.category) {
        const validCategories = ['lint', 'type-safety', 'complexity', 'hardcoded', 'srp'];
        if (typeof args.category !== 'string' || !validCategories.includes(args.category)) {
          return `Error: Invalid category. Must be one of: ${validCategories.join(', ')}`;
        }
        flagParts.push(`--category=${args.category}`);
      }
      return runKrolik(`fix ${flagParts.join(' ')}`, projectRoot, TIMEOUT_60S);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
