/**
 * @module cli/commands/init
 * @description Init command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register init command
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize krolik.config.ts')
    .option('--force', 'Overwrite existing config')
    .action(async (options: CommandOptions) => {
      const { runInit } = await import('../../commands/init');
      const ctx = await createContext(program, options);
      await runInit(ctx);
    });
}
