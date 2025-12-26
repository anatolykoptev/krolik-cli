/**
 * @module cli/commands/issue
 * @description Issue command registration
 */

import type { Command } from 'commander';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

/**
 * Register issue command
 */
export function registerIssueCommand(program: Command): void {
  program
    .command('issue [number]')
    .description('Parse GitHub issue and extract context: checklist, mentioned files, priority')
    .option('-u, --url <url>', 'Issue URL (alternative to number)')
    .option('--format <format>', 'Output format: ai, json, text, markdown (default: ai)')
    .action(async (number: string | undefined, options: CommandOptions) => {
      const { runIssue } = await import('../../commands/issue');
      const ctx = await createContext(program, {
        ...options,
        number: number ? parseInt(number, 10) : undefined,
      });
      await runIssue(ctx);
    });
}
