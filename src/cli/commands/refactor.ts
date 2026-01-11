/**
 * @module cli/commands/refactor
 * @description Refactor command registration
 */

import type { Command } from 'commander';
import { addDryRunOption, addModeSwitch, addPathOption, addProjectOption } from '../builders';
import { parseMode, resolveOutputFormat } from '../parsers';
import type { CommandOptions, GlobalProgramOptions, RefactorMode } from '../types';
import { handleProjectOption } from './helpers';

/**
 * Determine refactor mode from CLI options using parseMode
 */
function resolveMode(options: CommandOptions): RefactorMode {
  return parseMode(
    { quick: options.quick as boolean | undefined, deep: options.deep as boolean | undefined },
    ['quick', 'deep'],
    'default',
  ) as RefactorMode;
}

/**
 * Build complete refactor options from CLI options
 */
function buildRefactorOptions(
  options: CommandOptions,
  globalOpts: GlobalProgramOptions,
): Record<string, unknown> {
  // Use resolveOutputFormat from parsers, mapping 'ai' to 'xml' for this command
  const format = resolveOutputFormat(globalOpts, options);

  const opts: Record<string, unknown> = {
    format: format === 'ai' ? 'xml' : format,
  };

  // Path options
  if (options.path) opts.path = options.path;
  if (options.package) opts.package = options.package;

  // Boolean flags
  if (options.allPackages) opts.allPackages = true;
  if (options.dryRun) opts.dryRun = true;
  if (options.apply) opts.apply = true;
  if (options.fixTypes) opts.fixTypes = true;
  if (globalOpts.verbose) opts.verbose = true;

  // Typecheck timeout
  if (options.typecheckTimeout) opts.typecheckTimeout = options.typecheckTimeout;

  // Mode handling
  const mode = resolveMode(options);
  if (mode !== 'default') {
    opts.mode = mode;
  }

  return opts;
}

/**
 * Register refactor command
 */
export function registerRefactorCommand(program: Command): void {
  const cmd = program.command('refactor').description(
    `Analyze and refactor module structure

Modes:
  (default)        Function duplicates + structure (~3s)
  --quick          Structure only, no AST parsing (~1.5s)
  --deep           Full analysis with types (~30s)

Examples:
  krolik refactor                           # Default analysis
  krolik refactor --quick                   # Fast structure check
  krolik refactor --deep                    # Full analysis with types
  krolik refactor --apply                   # Apply suggested migrations
  krolik refactor --package api             # Analyze specific package
  krolik refactor --project piternow-wt-fix # Specific project`,
  );

  // Use builders for common options
  addProjectOption(cmd);
  addPathOption(cmd);
  addModeSwitch(cmd, ['quick', 'deep']);
  addDryRunOption(cmd);

  // Command-specific options
  cmd
    .option('--package <name>', 'Monorepo package to analyze (e.g., web, api)')
    .option('--all-packages', 'Analyze all packages in monorepo')
    .option('--apply', 'Apply migrations (creates backup, commits first)')
    .option('--fix-types', 'Auto-fix 100% identical type duplicates')
    .option(
      '--typecheck-timeout <ms>',
      'Typecheck timeout in milliseconds (default: 30000)',
      parseInt,
    )
    .action(async (options: CommandOptions) => {
      const { refactorCommand } = await import('../../commands/refactor');
      const globalOpts = program.opts() as GlobalProgramOptions;

      // Handle --project option (smart project detection)
      const resolvedProject = handleProjectOption(options);
      const projectRoot =
        resolvedProject || globalOpts.projectRoot || globalOpts.cwd || process.cwd();

      const refactorOpts = buildRefactorOptions(options, globalOpts);
      await refactorCommand(projectRoot, refactorOpts);
    });
}
