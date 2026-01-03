/**
 * @module cli/commands/progress
 * @description Progress command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register progress command
 */
export function registerProgressCommand(program: Command): void {
  program
    .command('progress')
    .description('Task/epic progress tracking')
    .option('--sync', 'Sync with GitHub issues before showing progress')
    .action(async (options: CommandOptions) => {
      const { runProgress } = await import('../../commands/progress');
      const ctx = await createContext(program, options);
      await runProgress(ctx);
    });
}
