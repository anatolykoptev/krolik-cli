/**
 * @module lib/security/escape
 * @description Escaping utilities for shell, regex, and other contexts
 *
 * Security-focused utilities for safely escaping strings before use in
 * shell commands or other sensitive contexts.
 */

/**
 * Escape shell argument for safe use in commands
 */
export function escapeShellArg(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`;
}

/**
 * Escape for use in double-quoted shell strings
 */
export function escapeDoubleQuotes(arg: string): string {
  return arg.replace(/[$`"\\]/g, '\\$&');
}

/**
 * Validate command name
 */
export function isValidCommandName(command: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(command);
}
