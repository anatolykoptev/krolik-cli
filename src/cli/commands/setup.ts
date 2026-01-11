/**
 * @module cli/commands/setup
 * @description Setup command registration
 */

import type { Command } from 'commander';
import { addDryRunOption, addForceOption } from '../builders';
import type { CommandOptions } from '../types';
import { createContext } from './helpers';

/**
 * Register setup command
 */
export function registerSetupCommand(program: Command): void {
  const cmd = program
    .command('setup')
    .description('Install plugins, agents, and MCP servers for krolik');

  // Use builders for common options
  addDryRunOption(cmd);
  addForceOption(cmd);

  // Command-specific options
  cmd
    .option('--all', 'Install everything (plugins + agents + MCP servers)')
    .option('--plugins', 'Install only Claude Code MCP plugins')
    .option('--agents', 'Install only AI agents (wshobson/agents)')
    .option('--mem', 'Install claude-mem (persistent memory)')
    .option('--mcp [server]', 'Install MCP server(s) — specify name or omit for all recommended')
    .option('--i18n', 'Install i18next-cli for internationalization')
    .option('--check', 'Check installed components and show recommendations')
    .option('--update', 'Update all installed components')
    .option('--list', 'List available plugins and agents')
    .action(async (options: CommandOptions) => {
      if (options.list) {
        const { listPlugins } = await import('../../commands/setup');
        listPlugins();
        return;
      }
      if (options.check) {
        const { printDiagnostics } = await import('../../commands/setup');
        printDiagnostics();
        return;
      }
      const { runSetup } = await import('../../commands/setup');
      const ctx = await createContext(program, options);
      await runSetup(ctx);
    });
}
