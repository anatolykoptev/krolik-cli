/**
 * @module cli/commands/review
 * @description Review command registration
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
 * Register review command
 */
export function registerReviewCommand(program: Command): void {
  program
    .command('review')
    .description('AI-assisted code review')
    .option('--pr <number>', 'Review specific PR')
    .option('--staged', 'Review staged changes only')
    .option('--base <branch>', 'Base branch to compare against (default: main)')
    .option('--with-agents', 'Run security, performance, and architecture agents')
    .option('--agents <list>', 'Specific agents to run (comma-separated)')
    .action(async (options: CommandOptions) => {
      const { runReview } = await import('../../commands/review');
      const ctx = await createContext(program, options);
      await runReview(ctx);
    });
}
