/**
 * @module cli/commands/issue
 * @description Issue command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register issue command
 */
export function registerIssueCommand(program: Command): void {
  program
    .command('issue [number]')
    .description('Parse GitHub issue')
    .option('-u, --url <url>', 'Issue URL')
    .action(async (number: string | undefined, options: CommandOptions) => {
      const { runIssue } = await import('../../commands/issue');
      const ctx = await createContext(program, {
        ...options,
        number: number ? parseInt(number, 10) : undefined,
      });
      await runIssue(ctx);
    });
}
