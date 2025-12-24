/**
 * @module cli/commands/setup
 * @description Setup command registration
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
 * Register setup command
 */
export function registerSetupCommand(program: Command): void {
  program
    .command('setup')
    .description('Install plugins, agents, and MCP servers for krolik')
    .option('--all', 'Install everything (plugins + agents + MCP servers)')
    .option('--plugins', 'Install only Claude Code MCP plugins')
    .option('--agents', 'Install only AI agents (wshobson/agents)')
    .option('--mem', 'Install claude-mem (persistent memory)')
    .option('--mcp [server]', 'Install MCP server(s) — specify name or omit for all recommended')
    .option('--check', 'Check installed components and show recommendations')
    .option('--update', 'Update all installed components')
    .option('--list', 'List available plugins and agents')
    .option('--dry-run', 'Preview without installing')
    .option('--force', 'Reinstall even if already installed')
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
