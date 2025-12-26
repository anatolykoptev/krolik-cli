/**
 * @module cli/commands/fix
 * @description Fix command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

/** Preset options derived from --quick, --deep, --full flags */
interface PresetOptions {
  trivialOnly?: boolean;
  safe?: boolean;
  all?: boolean;
  biome?: boolean;
  typecheck?: boolean;
  backup?: boolean;
}

/**
 * Parse preset flags (--quick, --deep, --full) into preset options
 */
function parsePresetOptions(options: CommandOptions): PresetOptions {
  const preset: PresetOptions = {};

  if (options.quick) {
    preset.trivialOnly = true;
    preset.biome = true;
    preset.typecheck = true;
  }
  if (options.deep) {
    preset.safe = true;
    preset.biome = true;
    preset.typecheck = true;
  }
  if (options.full) {
    preset.all = true;
    preset.biome = true;
    preset.typecheck = true;
    preset.backup = true;
  }

  return preset;
}

/**
 * Build fixer flags from CLI options (--fix-* and --no-* flags)
 */
function buildFixerFlags(options: CommandOptions): Record<string, boolean | undefined> {
  // Helper to get boolean value with fallback for --no-* flags
  const getBoolWithNegation = (fixKey: string, negationKey: string): boolean | undefined => {
    const fixValue = options[fixKey] as boolean | undefined;
    const negationValue = options[negationKey] as boolean | undefined;
    return fixValue ?? (negationValue !== false ? undefined : false);
  };

  return {
    fixConsole: getBoolWithNegation('fixConsole', 'console'),
    fixDebugger: getBoolWithNegation('fixDebugger', 'debugger'),
    fixAlert: options.fixAlert as boolean | undefined,
    fixTsIgnore: options.fixTsIgnore as boolean | undefined,
    fixAny: getBoolWithNegation('fixAny', 'any'),
    fixComplexity: options.fixComplexity as boolean | undefined,
    fixLongFunctions: options.fixLongFunctions as boolean | undefined,
    fixMagicNumbers: options.fixMagicNumbers as boolean | undefined,
    fixUrls: options.fixUrls as boolean | undefined,
    fixSrp: options.fixSrp as boolean | undefined,
  };
}

/**
 * Build context options by merging CLI options with presets
 */
function buildContextOptions(
  options: CommandOptions,
  preset: PresetOptions,
): Record<string, unknown> {
  const fixerFlags = buildFixerFlags(options);

  return {
    ...options,
    ...preset,
    dryRun: options.dryRun,
    format: options.format,
    showDiff: options.diff,
    trivialOnly: preset.trivialOnly ?? options.trivial,
    safe: preset.safe ?? options.safe,
    all: preset.all ?? options.all,
    fromAudit: options.fromAudit,
    quickWinsOnly: options.quickWins,
    biome: preset.biome ?? options.biome,
    biomeOnly: options.biomeOnly,
    noBiome: options.biome === false,
    typecheck: preset.typecheck ?? options.typecheck,
    typecheckOnly: options.typecheckOnly,
    noTypecheck: options.typecheck === false,
    backup: preset.backup ?? options.backup,
    ...fixerFlags,
  };
}

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
      if (options.listFixers) {
        const { listFixers } = await import('../../commands/fix');
        await listFixers();
        return;
      }

      const { runFix } = await import('../../commands/fix');
      const preset = parsePresetOptions(options);
      const contextOptions = buildContextOptions(options, preset);
      const ctx = await createContext(program, contextOptions);
      await runFix(ctx);
    });
}
