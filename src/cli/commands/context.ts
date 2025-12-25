/**
 * @module cli/commands/context
 * @description Context command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register context command
 */
export function registerContextCommand(program: Command): void {
  program
    .command('context')
    .description('Generate AI context for a task')
    .option('--issue <number>', 'Context for GitHub issue')
    .option('--feature <name>', 'Context for feature')
    .option('--file <path>', 'Context for file')
    .option('-q, --quick', 'Quick mode: architecture, git, tree, schema, routes only')
    .option('-d, --deep', 'Deep mode: imports, types, env, contracts only (complements --quick)')
    .option('--include-code', 'Include Zod schemas and example code snippets')
    .option('--domain-history', 'Include git history filtered by domain files')
    .option('--show-deps', 'Show domain dependencies from package.json')
    .option('--with-audit', 'Include quality issues for related files')
    .option('--with-issues', 'Include GitHub issues from gh CLI')
    .option('--no-architecture', 'Disable architecture patterns (enabled by default)')
    .option(
      '--full',
      'Enable all enrichment options (--include-code --domain-history --show-deps --with-audit)',
    )
    .action(async (options: CommandOptions) => {
      const { runContext } = await import('../../commands/context');

      // Architecture is ON by default (--no-architecture disables it)
      // Commander sets architecture=false when --no-architecture is used
      if (options.architecture === undefined) {
        options.architecture = true;
      }

      // --full enables --with-audit
      if (options.full) {
        options.withAudit = true;
      }

      const ctx = await createContext(program, options);
      await runContext(ctx);
    });
}
