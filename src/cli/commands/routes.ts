/**
 * @module cli/commands/routes
 * @description Routes command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

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
