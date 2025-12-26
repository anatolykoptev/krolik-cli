/**
 * @module cli/commands/fix
 * @description Fix command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

/**
 * Register fix command
 */
export function registerFixCommand(program: Command): void {
  program
    .command('fix')
    .description('Auto-fix code quality issues')
    .option('--path <path>', 'Path to analyze/fix (default: project root)')
    .option('--category <cat>', 'Only fix specific category: lint, type-safety, complexity')
    .option('--dry-run', 'Show what would be fixed without applying')
    .option('--format <fmt>', 'Output format: ai (default), text')
    .option('--diff', 'Show unified diff output (use with --dry-run)')
    .option('--trivial', 'Only fix trivial issues (console, debugger)')
    .option('--safe', 'Fix trivial + safe issues (excludes risky refactoring)')
    .option('--all', 'Include risky fixers (requires explicit confirmation)')
    .option('--from-audit', 'Use cached audit data (from krolik audit)')
    .option('--quick-wins', 'Only fix quick wins from audit (use with --from-audit)')
    // Preset flags for common combinations
    .option('--quick', 'Quick mode: --trivial --biome --typecheck')
    .option('--deep', 'Deep mode: --safe --biome --typecheck')
    .option('--full', 'Full mode: --all --biome --typecheck --backup')
    .option('--list-fixers', 'List all available fixers and exit')
    .option('--yes', 'Auto-confirm all fixes')
    .option('--backup', 'Create backup before fixing')
    .option('--limit <n>', 'Max fixes to apply', parseInt)
    .option('--biome', 'Run Biome auto-fix (default if available)')
    .option('--biome-only', 'Only run Biome, skip custom fixes')
    .option('--no-biome', 'Skip Biome even if available')
    .option('--typecheck', 'Run TypeScript check (default)')
    .option('--typecheck-only', 'Only run TypeScript check')
    .option('--no-typecheck', 'Skip TypeScript check')
    // Fixer flags - enable specific fixers
    .option('--fix-console', 'Fix console.log statements')
    .option('--fix-debugger', 'Fix debugger statements')
    .option('--fix-alert', 'Fix alert() calls')
    .option('--fix-ts-ignore', 'Fix @ts-ignore comments')
    .option('--fix-any', 'Fix `any` type usage')
    .option('--fix-complexity', 'Fix high complexity functions')
    .option('--fix-long-functions', 'Fix long functions')
    .option('--fix-magic-numbers', 'Fix magic numbers')
    .option('--fix-urls', 'Fix hardcoded URLs')
    .option('--fix-srp', 'Fix SRP violations')
    // Disable specific fixers
    .option('--no-console', 'Skip console.log fixes')
    .option('--no-debugger', 'Skip debugger fixes')
    .option('--no-any', 'Skip any type fixes')
    .action(async (options: CommandOptions) => {
      // Handle --list-fixers
      if (options.listFixers) {
        const { listFixers } = await import('../../commands/fix');
        await listFixers();
        return;
      }

      const { runFix } = await import('../../commands/fix');

      // Handle preset flags
      const presetOptions: {
        trivialOnly?: boolean;
        safe?: boolean;
        all?: boolean;
        biome?: boolean;
        typecheck?: boolean;
        backup?: boolean;
      } = {};

      // --quick = --trivial --biome --typecheck
      if (options.quick) {
        presetOptions.trivialOnly = true;
        presetOptions.biome = true;
        presetOptions.typecheck = true;
      }
      // --deep = --safe --biome --typecheck
      if (options.deep) {
        presetOptions.safe = true;
        presetOptions.biome = true;
        presetOptions.typecheck = true;
      }
      // --full = --all --biome --typecheck --backup
      if (options.full) {
        presetOptions.all = true;
        presetOptions.biome = true;
        presetOptions.typecheck = true;
        presetOptions.backup = true;
      }

      const ctx = await createContext(program, {
        ...options,
        ...presetOptions,
        dryRun: options.dryRun,
        format: options.format,
        showDiff: options.diff,
        trivialOnly: presetOptions.trivialOnly ?? options.trivial,
        safe: presetOptions.safe ?? options.safe,
        all: presetOptions.all ?? options.all,
        // Audit integration
        fromAudit: options.fromAudit,
        quickWinsOnly: options.quickWins,
        // Tool options
        biome: presetOptions.biome ?? options.biome,
        biomeOnly: options.biomeOnly,
        noBiome: options.biome === false,
        typecheck: presetOptions.typecheck ?? options.typecheck,
        typecheckOnly: options.typecheckOnly,
        noTypecheck: options.typecheck === false,
        backup: presetOptions.backup ?? options.backup,
        // Fixer flags
        fixConsole: options.fixConsole ?? (options.console !== false ? undefined : false),
        fixDebugger: options.fixDebugger ?? (options.debugger !== false ? undefined : false),
        fixAlert: options.fixAlert,
        fixTsIgnore: options.fixTsIgnore,
        fixAny: options.fixAny ?? (options.any !== false ? undefined : false),
        fixComplexity: options.fixComplexity,
        fixLongFunctions: options.fixLongFunctions,
        fixMagicNumbers: options.fixMagicNumbers,
        fixUrls: options.fixUrls,
        fixSrp: options.fixSrp,
      });
      await runFix(ctx);
    });
}
