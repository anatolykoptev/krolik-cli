/**
 * @module cli/commands/modules
 * @description Modules command registration
 */

import type { Command } from 'commander';
import { addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

interface ModulesCommandOptions extends CommandOptions {
  search?: string;
  get?: string;
  paths?: boolean;
}

/**
 * Register modules command
 */
export function registerModulesCommand(program: Command): void {
  const cmd = program.command('modules').description('Analyze reusable lib modules in the project');

  // Common options from builders
  addProjectOption(cmd);

  // Command-specific options
  cmd
    .option('-s, --search <query>', 'Search exports by name')
    .option('-g, --get <module>', 'Get detailed info about a specific module')
    .option('--paths', 'Show detected lib paths only')
    .addHelpText(
      'after',
      `
Examples:
  krolik modules                     # List all modules
  krolik modules --paths             # Show where modules are searched
  krolik modules --search parse      # Search for exports containing "parse"
  krolik modules --get fs            # Get details of @fs module
`,
    )
    .action(async (options: ModulesCommandOptions) => {
      const { runModules } = await import('../../commands/modules');
      handleProjectOption(options);
      const ctx = await createContext(program, options);

      // Determine action from options
      let action: 'list' | 'search' | 'get' | 'paths' = 'list';
      if (options.paths) action = 'paths';
      else if (options.search) action = 'search';
      else if (options.get) action = 'get';

      await runModules(ctx, {
        action,
        ...(options.search && { query: options.search }),
        ...(options.get && { module: options.get }),
      });
    });
}
