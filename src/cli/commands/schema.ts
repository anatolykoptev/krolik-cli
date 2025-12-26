/**
 * @module cli/commands/schema
 * @description Schema command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

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
