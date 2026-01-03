/**
 * @module mcp/tools/utils
 * @description Shared utilities for tool handlers
 */

import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the path to the CLI script
// After bundling, all code runs from dist/bin/cli.js, so __dirname is dist/bin
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// The CLI is the same bundle we're running from
const CLI_PATH = path.resolve(__dirname, 'cli.js');

// ============================================================================
// CONSTANTS
// ============================================================================

export const TIMEOUT_60S = 60000;
export const TIMEOUT_120S = 120000;

// ============================================================================
// INPUT SANITIZATION (Security: prevent command injection)
// ============================================================================

/**
 * Validate and sanitize a feature/task name
 * Only allows alphanumeric, hyphens, underscores, and dots
 */
export function sanitizeFeatureName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const sanitized = input.trim();
  if (sanitized.length === 0 || sanitized.length > 100) return null;
  // Only allow safe characters: alphanumeric, hyphen, underscore, dot, space
  if (!/^[a-zA-Z0-9_\-.\s]+$/.test(sanitized)) return null;
  return sanitized;
}

/**
 * Validate and sanitize a file/directory path
 * Allows alphanumeric, hyphens, underscores, dots, and forward slashes
 * Prevents path traversal attacks (../)
 */
export function sanitizePath(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const sanitized = input.trim();
  if (sanitized.length === 0 || sanitized.length > 500) return null;
  // Prevent path traversal
  if (sanitized.includes('..')) return null;
  // Only allow safe path characters: alphanumeric, hyphen, underscore, dot, slash
  if (!/^[a-zA-Z0-9_\-./]+$/.test(sanitized)) return null;
  return sanitized;
}

/**
 * Validate and sanitize an issue/PR number
 * Only allows positive integers
 */
export function sanitizeIssueNumber(input: unknown): number | null {
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

// ============================================================================
// TOOL EXECUTION
// ============================================================================

/**
 * Parse command string into array of arguments
 * Handles quoted strings and escaped characters properly
 */
function parseCommandArgs(command: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < command.length; i++) {
    const char = command[i];
    const nextChar = command[i + 1];

    if (char === '\\' && nextChar) {
      // Escaped character
      current += nextChar;
      i++; // Skip next character
    } else if ((char === '"' || char === "'") && !inQuotes) {
      // Start of quoted string
      inQuotes = true;
      quoteChar = char;
    } else if (char === quoteChar && inQuotes) {
      // End of quoted string
      inQuotes = false;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      // Space outside quotes - argument separator
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else {
      // Regular character
      current += char;
    }
  }

  // Add final argument if any
  if (current.length > 0) {
    args.push(current);
  }

  return args;
}

/**
 * Execute krolik CLI command using spawnSync for better security
 * @param args - Command arguments as a string (e.g., "status --fast")
 * @param projectRoot - Working directory for the command
 * @param timeout - Maximum execution time in milliseconds
 * @returns Command output or error message
 */
export function runKrolik(args: string, projectRoot: string, timeout = 30000): string {
  // Parse command string into array of arguments
  const argArray = parseCommandArgs(args);

  // Use node with absolute path to CLI instead of npx (package not published)
  // maxBuffer: 50MB to handle large outputs (default 1MB causes truncation)
  const result = spawnSync('node', [CLI_PATH, ...argArray], {
    cwd: projectRoot,
    encoding: 'utf-8',
    timeout,
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 50 * 1024 * 1024,
  });

  // Handle spawn errors (e.g., node executable not found)
  if (result.error) {
    return `Error: ${result.error.message}`;
  }

  // Handle timeout
  if (result.signal === 'SIGTERM') {
    return `Error: Command timed out after ${timeout}ms`;
  }

  // If command failed, return stderr or stdout with error info
  if (result.status !== 0) {
    const errorOutput = result.stderr || result.stdout || `Exit code: ${result.status}`;
    return errorOutput;
  }

  // Success - return stdout
  return result.stdout || '';
}

// ============================================================================
// ACTION-BASED TOOL HELPERS
// ============================================================================

/**
 * Action requirement definition for validation
 */
export interface ActionRequirement {
  /** Required parameter name */
  param: string;
  /** Error message if missing */
  message?: string;
}

/**
 * Action definition for multi-action tools
 */
export interface ActionDefinition {
  /** Required parameters for this action */
  requires?: ActionRequirement[];
}

/**
 * Validate action requirements for multi-action tools
 *
 * @param action - The action to validate
 * @param args - Tool arguments
 * @param actions - Map of action names to their definitions
 * @returns Error message if validation fails, undefined otherwise
 *
 * @example
 * const actions = {
 *   search: { requires: [{ param: 'query', message: 'query is required for search' }] },
 *   fetch: { requires: [{ param: 'library' }] },
 *   list: {}
 * };
 *
 * const error = validateActionRequirements('search', args, actions);
 * if (error) return error;
 */
export function validateActionRequirements(
  action: string,
  args: Record<string, unknown>,
  actions: Record<string, ActionDefinition>,
): string | undefined {
  const actionDef = actions[action];

  if (!actionDef) {
    const validActions = Object.keys(actions).join(', ');
    return `Error: Unknown action: ${action}. Valid actions: ${validActions}`;
  }

  if (actionDef.requires) {
    for (const req of actionDef.requires) {
      if (args[req.param] === undefined || args[req.param] === null || args[req.param] === '') {
        return req.message ?? `Error: ${req.param} is required for ${action} action`;
      }
    }
  }

  return undefined;
}

/**
 * Get string value from args with type safety
 */
export function getStringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Get number value from args with type safety
 */
export function getNumberArg(args: Record<string, unknown>, key: string): number | undefined {
  const value = args[key];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Get boolean value from args with type safety
 */
export function getBooleanArg(args: Record<string, unknown>, key: string): boolean {
  return args[key] === true;
}
