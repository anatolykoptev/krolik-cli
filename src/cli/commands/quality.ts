/**
 * @module cli/commands/quality
 * @description Quality command registration (deprecated, redirects to audit)
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';

/** Helper to create command context */
async function createContext(program: Command, options: CommandOptions) {
  const { createContext: createCtx } = await import('../context');
  return createCtx(program, options);
}

/**
 * Register quality command (deprecated)
 */
export function registerQualityCommand(program: Command): void {
  program
    .command('quality')
    .alias('lint')
    .description('[DEPRECATED] Use "audit" instead. Analyze code quality.')
    .option('--path <path>', 'Path to analyze (default: project root)')
    .action(async (options: CommandOptions) => {
      console.log(
        '\x1b[33m⚠️  "quality" command is deprecated. Use "krolik audit" instead.\x1b[0m\n',
      );
      const { runAudit } = await import('../../commands/audit');
      const ctx = await createContext(program, options);
      await runAudit(ctx);
    });
}
