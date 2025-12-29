/**
 * @module cli/commands/fix
 * @description Fix command registration
 *
 * Simplified CLI with mode system:
 * - (default): Safe fixes (biome + typecheck + safe fixers)
 * - --quick: Trivial only (console, debugger, alert)
 * - --all: Include risky fixers + auto-backup
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

/**
 * Resolve mode from CLI flags
 */
function resolveMode(options: CommandOptions): 'quick' | 'default' | 'all' {
  if (options.quick) return 'quick';
  if (options.all) return 'all';
  return 'default';
}

/**
 * Get mode-specific flags
 */
function getModeFlags(mode: 'quick' | 'default' | 'all'): Record<string, boolean> {
  switch (mode) {
    case 'quick':
      return {
        trivialOnly: true,
        biome: true,
        typecheck: true,
      };
    case 'all':
      return {
        all: true,
        biome: true,
        typecheck: true,
        backup: true, // Always backup on risky fixes
      };
    default:
      return {
        safe: true,
        biome: true,
        typecheck: true,
      };
  }
}

/**
 * Build fixer flags from CLI options (--fix-* flags)
 */
function buildFixerFlags(options: CommandOptions): Record<string, boolean | undefined> {
  return {
    fixConsole: options.fixConsole as boolean | undefined,
    fixDebugger: options.fixDebugger as boolean | undefined,
    fixAlert: options.fixAlert as boolean | undefined,
    fixTsIgnore: options.fixTsIgnore as boolean | undefined,
    fixAny: options.fixAny as boolean | undefined,
    fixComplexity: options.fixComplexity as boolean | undefined,
    fixLongFunctions: options.fixLongFunctions as boolean | undefined,
    fixMagicNumbers: options.fixMagicNumbers as boolean | undefined,
    fixUrls: options.fixUrls as boolean | undefined,
    fixSrp: options.fixSrp as boolean | undefined,
    fixDuplicate: options.fixDuplicate as boolean | undefined,
  };
}

/**
 * Build context options from CLI options
 */
function buildContextOptions(options: CommandOptions): Record<string, unknown> {
  const mode = resolveMode(options);
  const modeFlags = getModeFlags(mode);
  const fixerFlags = buildFixerFlags(options);

  return {
    ...options,
    ...modeFlags,
    ...fixerFlags,
    dryRun: options.dryRun,
    showDiff: options.dryRun, // Always show diff in dry-run
    fromAudit: options.fromAudit,
    fromRefactor: options.fromRefactor,
    format: 'ai', // Always AI format
  };
}

/**
 * Register fix command
 */
export function registerFixCommand(program: Command): void {
  program
    .command('fix')
    .description(
      `Auto-fix code quality issues

Modes:
  (default)    Safe fixes with biome + typecheck
  --quick      Trivial only: console, debugger, alert (~2s)
  --all        Include risky fixers + auto-backup

Examples:
  krolik fix --dry-run           # Preview all safe fixes
  krolik fix --quick             # Fast trivial cleanup
  krolik fix --all --yes         # Full fix with auto-confirm
  krolik fix --fix-console       # Only console.log fixes`,
    )
    // Base options (8)
    .option('--path <path>', 'Target path (default: project root)')
    .option('--category <cat>', 'Filter: lint, type-safety, complexity, hardcoded, srp')
    .option('--dry-run', 'Preview changes without applying')
    .option('--quick', 'Trivial fixes only (console, debugger, alert)')
    .option('--all', 'Include risky fixers + auto-backup')
    .option('--from-audit', 'Use cached audit data')
    .option('--from-refactor', 'Use cached refactor data (auto-fixable recommendations)')
    .option('--limit <n>', 'Max fixes to apply', parseInt)
    .option('--yes', 'Auto-confirm all fixes')
    // Fixer modules (10) - for granular control
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
    .option('--fix-duplicate', 'Fix duplicate functions (merge)')
    .action(async (options: CommandOptions) => {
      const { runFix } = await import('../../commands/fix');
      const contextOptions = buildContextOptions(options);
      const ctx = await createContext(program, contextOptions);
      await runFix(ctx);
    });
}
