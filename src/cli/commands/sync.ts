/**
 * @module cli/commands/sync
 * @description Sync command registration
 */

import type { Command } from 'commander';
import { loadConfig } from '../../config';
import { createLogger } from '../../lib/@log';
import type { CommandOptions } from '../types';

/**
 * Register sync command
 */
export function registerSyncCommand(program: Command): void {
  program
    .command('sync')
    .description('Sync krolik documentation to CLAUDE.md')
    .option('--force', 'Force update even if versions match')
    .option('--dry-run', 'Preview without changes')
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
