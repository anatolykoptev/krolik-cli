/**
 * @module cli/commands/context
 * @description Context command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

/**
 * Register context command
 */
export function registerContextCommand(program: Command): void {
  program
    .command('context')
    .description(
      `Generate AI context for a task

Modes:
  -q, --quick    Fast overview: architecture, git, tree, schema, routes (~2s)
  -d, --deep     Heavy analysis: imports, types, env, contracts (~5s)
  --full         All sections + quality audit (~10s)

Examples:
  krolik context --feature auth    # Context for auth feature
  krolik context --issue 42        # Context from GitHub issue
  krolik context --quick           # Fast mode for simple tasks`,
    )
    .option('--issue <number>', 'Context for GitHub issue')
    .option('--feature <name>', 'Context for feature')
    .option('--file <path>', 'Context for file')
    .option('-q, --quick', 'Quick mode: architecture, git, tree, schema, routes only')
    .option('-d, --deep', 'Deep mode: imports, types, env, contracts')
    .option('--full', 'Full mode: all sections + quality audit')
    .option('--with-issues', 'Include GitHub issues from gh CLI')
    .action(async (options: CommandOptions) => {
      const { runContext } = await import('../../commands/context');

      // Architecture is always ON (simplified from --no-architecture)
      options.architecture = true;

      // --full enables --with-audit
      if (options.full) {
        options.withAudit = true;
      }

      const ctx = await createContext(program, options);
      await runContext(ctx);
    });
}
