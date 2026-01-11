/**
 * @module cli/commands/schema
 * @description Schema command registration
 */

import type { Command } from 'commander';
import { addOutputLevelOptions, addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

interface SchemaCommandOptions extends CommandOptions {
  save?: boolean;
  model?: string;
  domain?: string;
  compact?: boolean;
  full?: boolean;
  project?: string;
}

/**
 * Register schema command
 */
export function registerSchemaCommand(program: Command): void {
  const cmd = program.command('schema').description('Analyze Prisma schema');

  // Common options from builders
  addProjectOption(cmd);
  addOutputLevelOptions(cmd);

  // Command-specific options
  cmd
    .option('--save', 'Save to SCHEMA.md')
    .option('-m, --model <name>', 'Filter by model name (partial match)')
    .option('-d, --domain <name>', 'Filter by domain name')
    .addHelpText(
      'after',
      `
Output modes:
  (default)   Smart format - optimized for AI, hides standard fields
  --compact   Overview only - models with relations, no field details
  --full      Verbose - all fields, all attributes (legacy format)

Examples:
  krolik schema                           # Smart format (recommended)
  krolik schema --compact                 # Compact overview
  krolik schema --full                    # Full verbose output
  krolik schema --domain Bookings         # Only Bookings domain
  krolik schema --model User              # Only models containing "User"
  krolik schema --project piternow-wt-fix # Specific project
`,
    )
    .action(async (options: SchemaCommandOptions) => {
      const { runSchema } = await import('../../commands/schema');
      handleProjectOption(options);

      const ctx = await createContext(program, options);
      await runSchema({
        ...ctx,
        options: {
          ...ctx.options,
          model: options.model,
          domain: options.domain,
          compact: options.compact,
          full: options.full,
        },
      });
    });
}
