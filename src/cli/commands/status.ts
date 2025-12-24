/**
 * @module cli/commands/status
 * @description Status command registration
 */

import type { Command } from 'commander';

/** Command options type */
interface CommandOptions {
  [key: string]: unknown;
}

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register status command
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Quick project diagnostics')
    .option('--fast', 'Skip slow checks (typecheck, lint)')
    .action(async (options: CommandOptions) => {
      const { runStatus } = await import('../../commands/status');
      const ctx = await createContext(program, options);
      await runStatus(ctx);
    });
}
