/**
 * @module cli/commands/routes
 * @description Routes command registration
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
 * Register routes command
 */
export function registerRoutesCommand(program: Command): void {
  program
    .command('routes')
    .description('Analyze tRPC routes')
    .option('--save', 'Save to ROUTES.md')
    .action(async (options: CommandOptions) => {
      const { runRoutes } = await import('../../commands/routes');
      const ctx = await createContext(program, options);
      await runRoutes(ctx);
    });
}
