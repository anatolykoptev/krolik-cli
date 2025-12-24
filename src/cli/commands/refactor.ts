/**
 * @module cli/commands/refactor
 * @description Refactor command registration
 */

import type { Command } from 'commander';

/** Command options type */
interface CommandOptions {
  [key: string]: unknown;
}

/**
 * Register refactor command
 */
export function registerRefactorCommand(program: Command): void {
  program
    .command('refactor')
    .description('Analyze and refactor module structure (duplicates, imports, @namespace organization)')
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
    .action(async (options: CommandOptions) => {
      const { refactorCommand } = await import('../../commands/refactor');
      const globalOpts = program.opts();
      const projectRoot = globalOpts.projectRoot || globalOpts.cwd || process.cwd();
      const refactorOpts: Record<string, unknown> = {
        format: globalOpts.json ? 'json' : globalOpts.text ? 'text' : 'xml',
      };
      // Support both --path and --lib-path (deprecated alias)
      if (options.path || options.libPath) {
        refactorOpts.path = options.path || options.libPath;
      }
      // Monorepo package options
      if (options.package) refactorOpts.package = options.package;
      if (options.allPackages) refactorOpts.allPackages = true;
      if (options.duplicatesOnly) refactorOpts.duplicatesOnly = true;
      if (options.typesOnly) refactorOpts.typesOnly = true;
      if (options.includeTypes) refactorOpts.includeTypes = true;
      if (options.structureOnly) refactorOpts.structureOnly = true;
      if (options.dryRun) refactorOpts.dryRun = true;
      if (options.apply) refactorOpts.apply = true;
      if (options.yes) refactorOpts.yes = true;
      if (globalOpts.verbose) refactorOpts.verbose = true;
      if (options.ai) refactorOpts.aiNative = true;
      if (options.generateConfig) refactorOpts.generateConfig = true;
      // backup defaults to true, only set if explicitly specified
      if (options.backup !== undefined) refactorOpts.backup = options.backup;
      // commit/push defaults to true, only set if explicitly specified
      if (options.commitFirst !== undefined) refactorOpts.commitFirst = options.commitFirst;
      if (options.push !== undefined) refactorOpts.push = options.push;
      // Type auto-fix options
      if (options.fixTypes) {
        refactorOpts.fixTypes = true;
        // Enable type analysis if not already
        if (!refactorOpts.typesOnly && !refactorOpts.includeTypes) {
          refactorOpts.includeTypes = true;
        }
      }
      if (options.fixTypesAll) {
        refactorOpts.fixTypes = true;
        refactorOpts.fixTypesIdenticalOnly = false;
        if (!refactorOpts.typesOnly && !refactorOpts.includeTypes) {
          refactorOpts.includeTypes = true;
        }
      }
      await refactorCommand(projectRoot, refactorOpts);
    });
}
