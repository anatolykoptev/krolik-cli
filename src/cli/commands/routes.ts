/**
 * @module cli/commands/routes
 * @description Routes command registration
 */

import type { Command } from 'commander';
import { resolveProjectPath } from '../../mcp/tools/core/projects';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

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
  program
    .command('routes')
    .description('Analyze tRPC routes')
    .option('--save', 'Save to ROUTES.md')
    .option('-c, --compact', 'Compact output (routers with procedure counts only)')
    .option('-f, --full', 'Full verbose output (all procedures with all attributes)')
    .option('-p, --project <name>', 'Project folder name (for multi-project workspaces)')
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

      // Handle --project option
      if (options.project) {
        const resolved = resolveProjectPath(process.cwd(), options.project);
        if ('error' in resolved) {
          console.error(resolved.error);
          process.exit(1);
        }
        process.env.KROLIK_PROJECT_ROOT = resolved.path;
      }

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
