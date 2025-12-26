/**
 * @module cli/commands/refactor
 * @description Refactor command registration
 */

import type { Command } from 'commander';
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
 * Apply boolean flags to refactor options
 */
function applyBooleanFlags(
  opts: Record<string, unknown>,
  options: CommandOptions,
  globalOpts: GlobalOptions,
): void {
  const booleanMappings: Array<[keyof CommandOptions, string]> = [
    ['allPackages', 'allPackages'],
    ['duplicatesOnly', 'duplicatesOnly'],
    ['typesOnly', 'typesOnly'],
    ['includeTypes', 'includeTypes'],
    ['structureOnly', 'structureOnly'],
    ['dryRun', 'dryRun'],
    ['apply', 'apply'],
    ['yes', 'yes'],
    ['generateConfig', 'generateConfig'],
  ];

  for (const [optKey, targetKey] of booleanMappings) {
    if (options[optKey]) opts[targetKey] = true;
  }

  if (globalOpts.verbose) opts.verbose = true;
  if (options.ai) opts.aiNative = true;
}

/**
 * Apply optional flags (only set if explicitly specified)
 */
function applyOptionalFlags(opts: Record<string, unknown>, options: CommandOptions): void {
  if (options.backup !== undefined) opts.backup = options.backup;
  if (options.commitFirst !== undefined) opts.commitFirst = options.commitFirst;
  if (options.push !== undefined) opts.push = options.push;
}

/**
 * Apply type fix options and enable type analysis if needed
 */
function applyTypeFixOptions(opts: Record<string, unknown>, options: CommandOptions): void {
  const needsTypeAnalysis = !opts.typesOnly && !opts.includeTypes;

  if (options.fixTypes) {
    opts.fixTypes = true;
    if (needsTypeAnalysis) opts.includeTypes = true;
  }

  if (options.fixTypesAll) {
    opts.fixTypes = true;
    opts.fixTypesIdenticalOnly = false;
    if (needsTypeAnalysis) opts.includeTypes = true;
  }
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

  // Path options (support deprecated --lib-path alias)
  if (options.path || options.libPath) {
    opts.path = options.path || options.libPath;
  }
  if (options.package) opts.package = options.package;

  applyBooleanFlags(opts, options, globalOpts);
  applyOptionalFlags(opts, options);
  applyTypeFixOptions(opts, options);

  // SWC is default (fast), --no-swc switches to ts-morph
  if (options.swc === false) {
    opts.useFastParser = false;
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
      'Analyze and refactor module structure (duplicates, imports, @namespace organization)',
    )
    .option('--path <path>', 'Path to analyze (default: auto-detect for monorepo)')
    .option('--lib-path <path>', 'Alias for --path (deprecated: use --path)')
    .option('--package <name>', 'Monorepo package to analyze (e.g., web, api)')
    .option('--all-packages', 'Analyze all packages in monorepo')
    .option('--duplicates-only', 'Only analyze duplicate functions')
    .option('--types-only', 'Only analyze duplicate types/interfaces')
    .option('--include-types', 'Include type/interface duplicate detection')
    .option('--structure-only', 'Only analyze module structure')
    .option('--dry-run', 'Show migration plan without applying')
    .option('--apply', 'Apply migrations (move files, update imports)')
    .option('--yes', 'Auto-confirm all changes')
    .option('--ai', 'AI-native enhanced output with dependency graphs and navigation hints')
    .option('--generate-config', 'Generate ai-config.ts for AI assistants')
    .option('--backup', 'Create git backup before applying (default: true)')
    .option('--no-backup', 'Skip git backup before applying')
    .option('--commit-first', 'Commit uncommitted changes before applying (default: true)')
    .option('--no-commit-first', 'Skip auto-commit before applying')
    .option('--push', 'Push auto-commit to remote (default: true)')
    .option('--no-push', 'Skip push to remote')
    .option('--fix-types', 'Auto-fix type duplicates (merge 100% identical types)')
    .option('--fix-types-all', 'Include similar types (90%+) in auto-fix')
    .option('--no-swc', 'Use ts-morph instead of SWC for parsing (slower but more accurate)')
    .action(async (options: CommandOptions) => {
      const { refactorCommand } = await import('../../commands/refactor');
      const globalOpts = program.opts() as GlobalOptions;
      const projectRoot = globalOpts.projectRoot || globalOpts.cwd || process.cwd();
      const refactorOpts = buildRefactorOptions(options, globalOpts);
      await refactorCommand(projectRoot, refactorOpts);
    });
}
