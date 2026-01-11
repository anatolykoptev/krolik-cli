/**
 * @module cli/commands/status
 * @description Status command registration
 */

import type { Command } from 'commander';
import { addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

/**
 * Register status command
 */
export function registerStatusCommand(program: Command): void {
  const cmd = program.command('status').description('Quick project diagnostics');
  addProjectOption(cmd);
  cmd.option('--fast', 'Skip slow checks (typecheck, lint)');
  cmd.action(async (options: CommandOptions) => {
    const { runStatus } = await import('../../commands/status');
    handleProjectOption(options);
    const ctx = await createContext(program, options);
    await runStatus(ctx);
  });
}
