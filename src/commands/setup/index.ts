/**
 * @module commands/setup
 * @description Setup command - install plugins and agents for krolik
 *
 * Modular structure:
 * - core/     - types, config, paths
 * - installers/ - mcp-plugin, agents, mcp-server
 * - diagnostics/ - checkers, output
 */

import type { CommandContext } from '../../types';
import { getPluginsByType } from './core/config';
import type { SetupOptions } from './core/types';
import { printDiagnostics } from './diagnostics';
import {
  ensureDirectories,
  installAgentsRepo,
  installAllMcpServers,
  installI18nextCli,
  installMcpPlugin,
  installMcpServer,
  updateAgentsRepo,
  updateMcpPlugin,
} from './installers';

// Re-export types and functions for external use
export type { SetupOptions } from './core/types';
export { listPlugins, printDiagnostics } from './diagnostics';

/**
 * Run setup command
 */
export async function runSetup(ctx: CommandContext & { options: SetupOptions }): Promise<void> {
  const { logger, options, config } = ctx;
  const projectRoot = config.projectRoot ?? process.cwd();
  const { all, plugins, agents, mem, mcp, i18n, update, check, dryRun, force } = options;

  // Handle --check: run diagnostics
  if (check) {
    printDiagnostics();
    return;
  }

  // Handle --update
  if (update) {
    await runUpdate({ dryRun: dryRun ?? false, logger });
    return;
  }

  // Handle --i18n: install i18next-cli
  if (i18n) {
    logger.info('🐰 Krolik Setup\n');
    if (dryRun) {
      logger.info('  [DRY RUN] No changes will be made\n');
    }
    await installI18nextCli(projectRoot, {
      dryRun: dryRun ?? false,
      force: force ?? false,
      logger,
    });
    return;
  }

  // Handle --mcp <server>: install specific MCP server
  if (mcp) {
    logger.info('🐰 Krolik Setup\n');
    if (dryRun) {
      logger.info('  [DRY RUN] No changes will be made\n');
    }

    if (typeof mcp === 'string') {
      // Install specific server
      await installMcpServer(mcp, { dryRun: dryRun ?? false, logger });
    } else {
      // Install all recommended MCP servers
      await installAllMcpServers({ dryRun: dryRun ?? false, logger });
    }
    return;
  }

  // Determine what to install
  const noSelection = !all && !plugins && !agents && !mem;
  const shouldInstallPlugins = all || plugins || mem || noSelection;
  const shouldInstallAgents = all || agents || noSelection;
  const shouldInstallMcp = all; // MCP servers only with --all

  logger.info('🐰 Krolik Setup\n');

  if (dryRun) {
    logger.info('  [DRY RUN] No changes will be made\n');
  }

  // Ensure directories exist
  if (!dryRun) {
    ensureDirectories();
  }

  // Install MCP plugins
  if (shouldInstallPlugins) {
    logger.info('📦 Installing Claude Code plugins...\n');
    if (mem || all || noSelection) {
      await installMcpPlugin('claude-mem', {
        dryRun: dryRun ?? false,
        force: force ?? false,
        logger,
      });
    }
  }

  // Install agents
  if (shouldInstallAgents) {
    logger.info('\n🤖 Installing AI agents...\n');
    await installAgentsRepo({
      dryRun: dryRun ?? false,
      force: force ?? false,
      logger,
    });
  }

  // Install MCP servers (only with --all)
  if (shouldInstallMcp) {
    logger.info('\n');
    await installAllMcpServers({ dryRun: dryRun ?? false, logger });
  }

  // Success message
  logger.info('\n✅ Setup complete!');
  logger.info('\n📝 Next steps:');
  logger.info('   1. Restart Claude Code to activate plugins');
  if (shouldInstallPlugins) {
    logger.info('   2. claude-mem Web UI: http://localhost:37777');
  }
  if (shouldInstallAgents) {
    logger.info('   3. Run: krolik agent --list');
  }
  logger.info('\n💡 Run: krolik setup --check  to see full status');
}

/**
 * Update all installed components
 */
async function runUpdate(opts: {
  dryRun: boolean;
  logger: CommandContext['logger'];
}): Promise<void> {
  const { dryRun, logger } = opts;

  logger.info('🔄 Updating installed components...\n');

  // Update agents
  await updateAgentsRepo({ dryRun, logger });

  // Update MCP plugins
  const mcpPlugins = getPluginsByType('mcp-plugin');
  for (const plugin of mcpPlugins) {
    await updateMcpPlugin(plugin, { dryRun, logger });
  }

  logger.info('\n✅ Update complete!');
}
