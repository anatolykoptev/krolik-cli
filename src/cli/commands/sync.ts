/**
 * @module cli/commands/sync
 * @description Sync command registration
 */

import type { Command } from 'commander';
import { loadConfig } from '../../config';
import { createLogger } from '../../lib/@core/logger';
import { addDryRunOption, addForceOption } from '../builders';
import type { CommandOptions } from '../types';

/**
 * Register sync command
 */
export function registerSyncCommand(program: Command): void {
  const cmd = program.command('sync').description('Sync krolik documentation to CLAUDE.md');

  // Use builders for common options
  addDryRunOption(cmd);
  addForceOption(cmd);

  // Command-specific options
  cmd
    .option('--status', 'Show current sync status')
    .option('--create-subdocs', 'Create missing CLAUDE.md for packages/apps')
    .action(async (options: CommandOptions) => {
      const { runSync } = await import('../../commands/sync');
      const globalOpts = program.opts();
      const projectRoot = globalOpts.projectRoot || globalOpts.cwd || process.cwd();
      const config = await loadConfig({ projectRoot });
      const logger = createLogger({ level: globalOpts.verbose ? 'debug' : 'info' });
      await runSync({ config, logger, options });
    });
}
