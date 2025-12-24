/**
 * @module cli/commands/context
 * @description Context command registration
 */

import type { Command } from 'commander';

/** Command options type */
interface CommandOptions {
  [key: string]: unknown;
}

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
    .option('--include-code', 'Include Zod schemas and example code snippets')
    .option('--domain-history', 'Include git history filtered by domain files')
    .option('--show-deps', 'Show domain dependencies from package.json')
    .option('--with-audit', 'Include quality issues for related files')
    .option(
      '--full',
      'Enable all enrichment options (--include-code --domain-history --show-deps --with-audit)',
    )
    .action(async (options: CommandOptions) => {
      const { runContext } = await import('../../commands/context');
      // --full enables --with-audit
      if (options.full) {
        options.withAudit = true;
      }
      const ctx = await createContext(program, options);
      await runContext(ctx);
    });
}
