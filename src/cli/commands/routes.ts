/**
 * @module cli/commands/routes
 * @description Routes command registration
 */

import type { Command } from 'commander';
import { addOutputLevelOptions, addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

interface RoutesCommandOptions extends CommandOptions {
  save?: boolean;
  compact?: boolean;
  full?: boolean;
  project?: string;
}

/**
 * Register routes command
 */
export function registerRoutesCommand(program: Command): void {
  const cmd = program.command('routes').description('Analyze tRPC routes');

  // Common options from builders
  addProjectOption(cmd);
  addOutputLevelOptions(cmd);

  // Command-specific options
  cmd
    .option('--save', 'Save to ROUTES.md')
    .addHelpText(
      'after',
      `
Output modes:
  (default)   Smart format - groups procedures by type, shows only exceptions
  --compact   Overview only - routers with Q/M counts
  --full      Verbose - all procedures, all attributes (legacy format)

Examples:
  krolik routes                           # Smart format (recommended)
  krolik routes --compact                 # Compact overview
  krolik routes --full                    # Full verbose output
  krolik routes --project piternow-wt-fix # Specific project
`,
    )
    .action(async (options: RoutesCommandOptions) => {
      const { runRoutes } = await import('../../commands/routes');
      handleProjectOption(options);

      const ctx = await createContext(program, options);
      await runRoutes({
        ...ctx,
        options: {
          ...ctx.options,
          compact: options.compact,
          full: options.full,
        },
      });
    });
}
