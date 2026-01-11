/**
 * @module cli/commands/init
 * @description Init command registration
 */

import type { Command } from 'commander';
import { addForceOption, addProjectOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext, handleProjectOption } from './helpers';

/**
 * Register init command
 */
export function registerInitCommand(program: Command): void {
  const cmd = program.command('init').description('Initialize krolik.config.ts');
  addProjectOption(cmd);
  addForceOption(cmd);
  cmd.action(async (options: CommandOptions) => {
    const { runInit } = await import('../../commands/init');
    handleProjectOption(options);
    const ctx = await createContext(program, options);
    await runInit(ctx);
  });
}
