/**
 * @module cli/commands/schema
 * @description Schema command registration
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
 * Register schema command
 */
export function registerSchemaCommand(program: Command): void {
  program
    .command('schema')
    .description('Analyze Prisma schema')
    .option('--save', 'Save to SCHEMA.md')
    .action(async (options: CommandOptions) => {
      const { runSchema } = await import('../../commands/schema');
      const ctx = await createContext(program, options);
      await runSchema(ctx);
    });
}
