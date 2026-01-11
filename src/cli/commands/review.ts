/**
 * @module cli/commands/review
 * @description Review command registration
 */

import type { Command } from 'commander';
import { addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

/**
 * Register review command
 */
export function registerReviewCommand(program: Command): void {
  const cmd = program.command('review').description('AI-assisted code review');
  addProjectOption(cmd);
  cmd
    .option('--pr <number>', 'Review specific PR')
    .option('--staged', 'Review staged changes only')
    .option('--base <branch>', 'Base branch to compare against (default: main)')
    .option('--with-agents', 'Run security, performance, and architecture agents')
    .option('--agents <list>', 'Specific agents to run (comma-separated)');
  cmd.action(async (options: CommandOptions) => {
    const { runReview } = await import('../../commands/review');
    handleProjectOption(options);
    const ctx = await createContext(program, options);
    await runReview(ctx);
  });
}
