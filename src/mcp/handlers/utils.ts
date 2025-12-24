/**
 * @module mcp/handlers/utils
 * @description Shared utilities for tool handlers
 */

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

// Get the path to the CLI script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CLI_PATH = path.resolve(__dirname, '../../bin/cli.js');

// ============================================================================
// CONSTANTS
// ============================================================================

export const TIMEOUT_60S = 60000;

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

/**
 * Escape shell argument for safe use in commands
 */
export function escapeShellArg(arg: string): string {
  // Replace single quotes with escaped version and wrap in single quotes
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

// ============================================================================
// TOOL EXECUTION
// ============================================================================

/**
 * Execute krolik CLI command
 */
export function runKrolik(args: string, projectRoot: string, timeout = 30000): string {
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
