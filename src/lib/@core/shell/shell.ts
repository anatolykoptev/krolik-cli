/**
 * @module lib/@core/shell
 * @description Shell command execution utilities
 */

import { type ExecSyncOptions, execSync } from 'node:child_process';

/**
 * Shell execution options
 */
export interface ShellOptions {
  /** Working directory */
  cwd?: string;
  /** Suppress output */
  silent?: boolean;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Shell execution result
 */
export interface ShellResult {
  /** Command succeeded */
  success: boolean;
  /** Command output */
  output: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Execute a shell command and return trimmed output
 *
 * @throws Error if command fails
 */
export function exec(command: string, options: ShellOptions = {}): string {
  const { cwd, silent = true, timeout = 30000, env } = options;

  const execOptions: ExecSyncOptions = {
    cwd,
    encoding: 'utf-8',
    stdio: silent ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    timeout,
    env: env ? { ...process.env, ...env } : undefined,
  };

  return execSync(command, execOptions).toString().trim();
}

/**
 * Execute a shell command and return result object (never throws)
 */
export function tryExec(command: string, options: ShellOptions = {}): ShellResult {
  try {
    const output = exec(command, options);
    return { success: true, output };
  } catch (error) {
    const err = error as { stdout?: Buffer; stderr?: Buffer; message?: string };
    return {
      success: false,
      output: err.stdout?.toString() ?? '',
      error: err.stderr?.toString() ?? err.message ?? 'Unknown error',
    };
  }
}

/**
 * Execute a shell command and return lines array
 */
export function execLines(command: string, options: ShellOptions = {}): string[] {
  const result = tryExec(command, options);
  if (!result.success || !result.output) {
    return [];
  }
  return result.output.split('\n').filter(Boolean);
}

/**
 * Check if a command exists in PATH
 */
export function commandExists(command: string): boolean {
  const result = tryExec(`command -v ${command}`);
  return result.success && result.output.length > 0;
}

/**
 * Get npm/pnpm package manager in use
 */
export function getPackageManager(): 'npm' | 'pnpm' | 'yarn' | 'bun' {
  if (commandExists('pnpm')) return 'pnpm';
  if (commandExists('yarn')) return 'yarn';
  if (commandExists('bun')) return 'bun';
  return 'npm';
}

/**
 * Create shell options with optional cwd (convenience helper)
 */
export function shellOpts(cwd?: string): ShellOptions {
  const opts: ShellOptions = { silent: true };
  if (cwd) opts.cwd = cwd;
  return opts;
}
