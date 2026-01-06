/**
 * @module cli/commands/schema
 * @description Schema command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

interface SchemaCommandOptions extends CommandOptions {
  save?: boolean;
  model?: string;
  domain?: string;
  compact?: boolean;
}

/**
 * Register schema command
 */
export function registerSchemaCommand(program: Command): void {
  program
    .command('schema')
    .description('Analyze Prisma schema')
    .option('--save', 'Save to SCHEMA.md')
    .option('-m, --model <name>', 'Filter by model name (partial match)')
    .option('-d, --domain <name>', 'Filter by domain name')
    .option('-c, --compact', 'Compact output (models with relations only, no field details)')
    .addHelpText(
      'after',
      `
Examples:
  krolik schema                    # Full schema (may be large)
  krolik schema --compact          # Compact view - just models and relations
  krolik schema --domain Bookings  # Only Bookings domain
  krolik schema --model User       # Only models containing "User"
`,
    )
    .action(async (options: SchemaCommandOptions) => {
      const { runSchema } = await import('../../commands/schema');
      const ctx = await createContext(program, options);
      await runSchema({
        ...ctx,
        options: {
          ...ctx.options,
          model: options.model,
          domain: options.domain,
          compact: options.compact,
        },
      });
    });
}
