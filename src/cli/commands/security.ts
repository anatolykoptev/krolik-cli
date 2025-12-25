/**
 * @module cli/commands/security
 * @description Security command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register security command
 */
export function registerSecurityCommand(program: Command): void {
  program
    .command('security')
    .description('Run security audit')
    .option('--fix', 'Attempt to fix issues')
    .action(async (options: CommandOptions) => {
      const { runSecurity } = await import('../../commands/security');
      const ctx = await createContext(program, options);
      await runSecurity(ctx);
    });
}
