/**
 * @module cli/commands/progress
 * @description Progress command registration
 */

import type { Command } from 'commander';
import { addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

/**
 * Register progress command
 */
export function registerProgressCommand(program: Command): void {
  const cmd = program.command('progress').description('Task/epic progress tracking');
  addProjectOption(cmd);
  cmd.option('--sync', 'Sync with GitHub issues before showing progress');
  cmd.action(async (options: CommandOptions) => {
    const { runProgress } = await import('../../commands/progress');
    handleProjectOption(options);
    const ctx = await createContext(program, options);
    await runProgress(ctx);
  });
}
