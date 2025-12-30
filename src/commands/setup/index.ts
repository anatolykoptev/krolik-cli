/**
 * @module commands/setup
 * @description Setup command - install plugins and agents for krolik
 *
 * Modular structure:
 * - core/     - types, config, paths
 * - installers/ - mcp-plugin, agents, mcp-server
 * - diagnostics/ - checkers, output
 */

import type { CommandContext } from '../../types/commands/base';
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
 * Context passed to setup step handlers
 */
interface SetupContext {
  logger: CommandContext['logger'];
  projectRoot: string;
  options: SetupOptions;
}

/**
 * Determine what components should be installed
 */
interface InstallTargets {
  shouldInstallPlugins: boolean;
  shouldInstallAgents: boolean;
  shouldInstallMcp: boolean;
}

/**
 * Handle --check flag: run diagnostics
 */
function handleCheck(ctx: SetupContext): boolean {
  if (!ctx.options.check) return false;
  printDiagnostics();
  return true;
}

/**
 * Handle --update flag: update all components
 */
async function handleUpdate(ctx: SetupContext): Promise<boolean> {
  if (!ctx.options.update) return false;
  await runUpdate({ dryRun: ctx.options.dryRun ?? false, logger: ctx.logger });
  return true;
}

/**
 * Handle --i18n flag: install i18next-cli
 */
async function handleI18n(ctx: SetupContext): Promise<boolean> {
  if (!ctx.options.i18n) return false;

  logHeader(ctx.logger, ctx.options.dryRun);
  await installI18nextCli(ctx.projectRoot, {
    dryRun: ctx.options.dryRun ?? false,
    force: ctx.options.force ?? false,
    logger: ctx.logger,
  });
  return true;
}

/**
 * Handle --mcp flag: install MCP servers
 */
async function handleMcp(ctx: SetupContext): Promise<boolean> {
  if (!ctx.options.mcp) return false;

  logHeader(ctx.logger, ctx.options.dryRun);

  if (typeof ctx.options.mcp === 'string') {
    await installMcpServer(ctx.options.mcp, {
      dryRun: ctx.options.dryRun ?? false,
      logger: ctx.logger,
    });
  } else {
    await installAllMcpServers({
      dryRun: ctx.options.dryRun ?? false,
      logger: ctx.logger,
    });
  }
  return true;
}

/**
 * Determine what to install based on options
 */
function determineInstallTargets(options: SetupOptions): InstallTargets {
  const { all, plugins, agents, mem } = options;
  const noSelection = !all && !plugins && !agents && !mem;

  return {
    shouldInstallPlugins: all || plugins || mem || noSelection,
    shouldInstallAgents: all || agents || noSelection,
    shouldInstallMcp: all ?? false,
  };
}

/**
 * Log setup header with optional dry-run notice
 */
function logHeader(logger: CommandContext['logger'], dryRun?: boolean): void {
  logger.info('🐰 Krolik Setup\n');
  if (dryRun) {
    logger.info('  [DRY RUN] No changes will be made\n');
  }
}

/**
 * Install MCP plugins (claude-mem)
 */
async function installPlugins(ctx: SetupContext, targets: InstallTargets): Promise<void> {
  if (!targets.shouldInstallPlugins) return;

  const { all, mem } = ctx.options;
  const noSelection = !all && !ctx.options.plugins && !ctx.options.agents && !mem;

  ctx.logger.info('📦 Installing Claude Code plugins...\n');
  if (mem || all || noSelection) {
    await installMcpPlugin('claude-mem', {
      dryRun: ctx.options.dryRun ?? false,
      force: ctx.options.force ?? false,
      logger: ctx.logger,
    });
  }
}

/**
 * Install AI agents repository
 */
async function installAgents(ctx: SetupContext, targets: InstallTargets): Promise<void> {
  if (!targets.shouldInstallAgents) return;

  ctx.logger.info('\n🤖 Installing AI agents...\n');
  await installAgentsRepo({
    dryRun: ctx.options.dryRun ?? false,
    force: ctx.options.force ?? false,
    logger: ctx.logger,
  });
}

/**
 * Install all MCP servers (only with --all flag)
 */
async function installMcpServers(ctx: SetupContext, targets: InstallTargets): Promise<void> {
  if (!targets.shouldInstallMcp) return;

  ctx.logger.info('\n');
  await installAllMcpServers({
    dryRun: ctx.options.dryRun ?? false,
    logger: ctx.logger,
  });
}

/**
 * Print success message and next steps
 */
function printSuccessMessage(logger: CommandContext['logger'], targets: InstallTargets): void {
  logger.info('\n✅ Setup complete!');
  logger.info('\n📝 Next steps:');
  logger.info('   1. Restart Claude Code to activate plugins');
  if (targets.shouldInstallPlugins) {
    logger.info('   2. claude-mem Web UI: http://localhost:37777');
  }
  if (targets.shouldInstallAgents) {
    logger.info('   3. Run: krolik agent --list');
  }
  logger.info('\n💡 Run: krolik setup --check  to see full status');
}

/**
 * Run setup command
 */
export async function runSetup(ctx: CommandContext & { options: SetupOptions }): Promise<void> {
  const { logger, options, config } = ctx;
  const projectRoot = config.projectRoot ?? process.cwd();

  const setupCtx: SetupContext = { logger, projectRoot, options };

  // Handle single-action flags with early returns
  if (handleCheck(setupCtx)) return;
  if (await handleUpdate(setupCtx)) return;
  if (await handleI18n(setupCtx)) return;
  if (await handleMcp(setupCtx)) return;

  // Full setup: determine targets and install
  const targets = determineInstallTargets(options);

  logHeader(logger, options.dryRun);

  if (!options.dryRun) {
    ensureDirectories();
  }

  await installPlugins(setupCtx, targets);
  await installAgents(setupCtx, targets);
  await installMcpServers(setupCtx, targets);

  printSuccessMessage(logger, targets);
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

  await updateAgentsRepo({ dryRun, logger });

  const mcpPlugins = getPluginsByType('mcp-plugin');
  for (const plugin of mcpPlugins) {
    await updateMcpPlugin(plugin, { dryRun, logger });
  }

  logger.info('\n✅ Update complete!');
}
