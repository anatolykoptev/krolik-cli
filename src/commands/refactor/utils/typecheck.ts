/**
 * @module commands/refactor/utils/typecheck
 * @description TypeScript type checking utilities
 */

import { type ChildProcess, spawn } from 'node:child_process';

/** Default timeout for typecheck (30 seconds) */
export const DEFAULT_TYPECHECK_TIMEOUT = 30_000;

/**
 * Typecheck result
 */
export interface TypecheckResult {
  success: boolean;
  errors: number;
  output: string;
  duration: number;
  timedOut?: boolean;
}

/**
 * Options for typecheck
 */
export interface TypecheckOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number;
}

/**
 * Kill a child process and all its descendants
 */
function killProcess(child: ChildProcess): void {
  try {
    // Try to kill the process group (negative pid)
    if (child.pid) {
      process.kill(-child.pid, 'SIGTERM');
    }
  } catch {
    // Fallback to killing just the child
    try {
      child.kill('SIGTERM');
    } catch {
      // Process already dead
    }
  }
}

/**
 * Run pnpm typecheck and capture results
 *
 * @param projectRoot - Project root directory
 * @param options - Typecheck options including timeout
 * @returns Typecheck result with success status, errors count, and output
 *
 * @example
 * ```ts
 * // With default 30s timeout
 * const result = await runTypecheck('/path/to/project');
 *
 * // With custom timeout
 * const result = await runTypecheck('/path/to/project', { timeout: 60000 });
 *
 * if (result.timedOut) {
 *   console.log('Typecheck timed out, consider increasing --typecheck-timeout');
 * }
 * ```
 */
export async function runTypecheck(
  projectRoot: string,
  options: TypecheckOptions = {},
): Promise<TypecheckResult> {
  const timeout = options.timeout ?? DEFAULT_TYPECHECK_TIMEOUT;
  const startTime = Date.now();

  return new Promise((resolve) => {
    let resolved = false;
    let timeoutId: NodeJS.Timeout | undefined;

    const child = spawn('pnpm', ['run', 'typecheck'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true, // Allow killing process group
    });

    let stdout = '';
    let stderr = '';

    // Set up timeout
    if (timeout > 0) {
      timeoutId = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          killProcess(child);

          const duration = (Date.now() - startTime) / 1000;
          resolve({
            success: false,
            errors: -1,
            output: `Typecheck timed out after ${timeout / 1000}s. Consider increasing --typecheck-timeout.`,
            duration,
            timedOut: true,
          });
        }
      }, timeout);
    }

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (resolved) return;
      resolved = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = (Date.now() - startTime) / 1000;
      const output = stdout + stderr;

      // Count TypeScript errors (pattern: "error TS")
      const errorMatches = output.match(/error TS\d+/g);
      const errors = errorMatches?.length ?? 0;

      resolve({
        success: code === 0,
        errors,
        output: output.trim(),
        duration,
      });
    });

    child.on('error', () => {
      if (resolved) return;
      resolved = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      resolve({
        success: false,
        errors: -1,
        output: 'Failed to run pnpm typecheck',
        duration: (Date.now() - startTime) / 1000,
      });
    });
  });
}
