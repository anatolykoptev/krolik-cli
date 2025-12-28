/**
 * @module commands/refactor/utils/typecheck
 * @description TypeScript type checking utilities
 */

import { spawn } from 'node:child_process';

/**
 * Typecheck result
 */
export interface TypecheckResult {
  success: boolean;
  errors: number;
  output: string;
  duration: number;
}

/**
 * Run pnpm typecheck and capture results
 */
export async function runTypecheck(projectRoot: string): Promise<TypecheckResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    const child = spawn('pnpm', ['run', 'typecheck'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
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
      resolve({
        success: false,
        errors: -1,
        output: 'Failed to run pnpm typecheck',
        duration: (Date.now() - startTime) / 1000,
      });
    });
  });
}
