/**
 * @module cli/commands/refactor
 * @description Refactor command registration
 */

import type { Command } from 'commander';
import type { RefactorMode } from '../../commands/refactor/core/options';
import type { CommandOptions } from '../types';

/** Global options from program.opts() */
interface GlobalOptions {
  projectRoot?: string;
  cwd?: string;
  json?: boolean;
  text?: boolean;
  verbose?: boolean;
}

/**
 * Determine output format from global options
 */
function getOutputFormat(globalOpts: GlobalOptions): string {
  if (globalOpts.json) return 'json';
  if (globalOpts.text) return 'text';
  return 'xml';
}

/**
 * Determine refactor mode from CLI options
 */
function determineMode(options: CommandOptions): RefactorMode | undefined {
  if (options.quick) return 'quick';
  if (options.deep) return 'deep';
  return undefined; // default mode
}

/**
 * Build complete refactor options from CLI options
 */
function buildRefactorOptions(
  options: CommandOptions,
  globalOpts: GlobalOptions,
): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    format: getOutputFormat(globalOpts),
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

  // Mode handling - resolveMode in analysis.ts will handle the rest
  const mode = determineMode(options);
  if (mode) {
    opts.mode = mode;
  }

  return opts;
}

/**
 * Register refactor command
 */
export function registerRefactorCommand(program: Command): void {
  program
    .command('refactor')
    .description(
      `Analyze and refactor module structure

Modes:
  (default)        Function duplicates + structure (~3s)
  --quick          Structure only, no AST parsing (~1.5s)
  --deep           Full analysis with types (~30s)

Examples:
  krolik refactor                    # Default analysis
  krolik refactor --quick            # Fast structure check
  krolik refactor --deep             # Full analysis with types
  krolik refactor --apply            # Apply suggested migrations
  krolik refactor --package api      # Analyze specific package`,
    )
    .option('--path <path>', 'Path to analyze (default: auto-detect)')
    .option('--package <name>', 'Monorepo package to analyze (e.g., web, api)')
    .option('--all-packages', 'Analyze all packages in monorepo')
    .option('--quick', 'Quick mode: structure only, no AST (~1.5s)')
    .option('--deep', 'Deep mode: + types, + git history (~30s)')
    .option('--dry-run', 'Show migration plan without applying')
    .option('--apply', 'Apply migrations (creates backup, commits first)')
    .option('--fix-types', 'Auto-fix 100% identical type duplicates')
    .action(async (options: CommandOptions) => {
      const { refactorCommand } = await import('../../commands/refactor');
      const globalOpts = program.opts() as GlobalOptions;
      const projectRoot = globalOpts.projectRoot || globalOpts.cwd || process.cwd();
      const refactorOpts = buildRefactorOptions(options, globalOpts);
      await refactorCommand(projectRoot, refactorOpts);
    });
}
