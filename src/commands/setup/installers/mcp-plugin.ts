/**
 * @module commands/setup/installers/mcp-plugin
 * @description MCP plugin installer (clone + npm install + build)
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import type { InstallerOptions, InstallResult, PluginConfig } from '../core/types';
import { getPlugin } from '../core/config';
import { getMarketplacePath, getPluginInstallPath } from '../core/paths';
import { registerMarketplace, registerPlugin, ensureClaudeMemDataDir } from './utils';

/**
 * Install an MCP plugin (clone + npm install + build)
 */
export async function installMcpPlugin(
  pluginId: string,
  opts: InstallerOptions,
): Promise<InstallResult> {
  const { dryRun, force = false, logger } = opts;
  const plugin = getPlugin(pluginId);

  if (!plugin || plugin.type !== 'mcp-plugin') {
    return { success: false, error: `Unknown MCP plugin: ${pluginId}` };
  }

  logger.info(`  📦 ${plugin.name}`);
  logger.info(`     ${plugin.description}`);

  const marketplaceDir = getMarketplacePath(plugin.marketplace);
  const pluginInstallDir = getPluginInstallPath(plugin.marketplace, plugin.pluginPath);

  // Check if already installed
  if (fs.existsSync(pluginInstallDir) && !force) {
    logger.info(`     ⏭️  Already installed (use --force to reinstall)`);
    return { success: true, message: 'Already installed' };
  }

  if (dryRun) {
    logger.info(`     [DRY RUN] Would clone ${plugin.repo}`);
    logger.info(`     [DRY RUN] Would install to ${marketplaceDir}`);
    return { success: true, message: 'Dry run' };
  }

  try {
    // Clone repository
    logger.info(`     Cloning from GitHub...`);

    // Remove existing directory if force
    if (fs.existsSync(marketplaceDir) && force) {
      fs.rmSync(marketplaceDir, { recursive: true });
    }

    const cloneResult = spawnSync(
      'git',
      ['clone', '--depth', '1', `https://github.com/${plugin.repo}.git`, marketplaceDir],
      { stdio: 'pipe', encoding: 'utf8' },
    );

    if (cloneResult.status !== 0) {
      throw new Error(cloneResult.stderr || 'Clone failed');
    }

    // Install dependencies
    logger.info(`     Installing dependencies...`);
    const npmResult = spawnSync('npm', ['install'], {
      cwd: marketplaceDir,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    if (npmResult.status !== 0) {
      throw new Error(npmResult.stderr || 'npm install failed');
    }

    // Build plugin
    logger.info(`     Building plugin...`);
    const buildResult = spawnSync('npm', ['run', 'build'], {
      cwd: marketplaceDir,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    if (buildResult.status !== 0) {
      throw new Error(buildResult.stderr || 'Build failed');
    }

    // Register marketplace and plugin
    registerMarketplace(plugin);
    registerPlugin(plugin, pluginInstallDir);

    // Create data directory for claude-mem
    if (pluginId === 'claude-mem') {
      ensureClaudeMemDataDir();
    }

    logger.info(`     ✅ Installed successfully`);
    return { success: true, message: 'Installed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`     ❌ Failed: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Update an MCP plugin (git pull + npm install + build)
 */
export async function updateMcpPlugin(
  plugin: PluginConfig,
  opts: InstallerOptions,
): Promise<InstallResult> {
  const { dryRun, logger } = opts;
  const marketplaceDir = getMarketplacePath(plugin.marketplace);

  if (!fs.existsSync(marketplaceDir + '/.git')) {
    return { success: false, error: 'Not installed' };
  }

  logger.info(`\n  📦 Updating ${plugin.name}...`);

  if (dryRun) {
    logger.info('     [DRY RUN] Would run git pull && npm install && npm run build');
    return { success: true, message: 'Dry run' };
  }

  try {
    const pullResult = spawnSync('git', ['pull', '--ff-only'], {
      cwd: marketplaceDir,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    if (pullResult.status === 0 && !pullResult.stdout?.includes('Already up to date')) {
      // Rebuild if there were updates
      spawnSync('npm', ['install'], { cwd: marketplaceDir, stdio: 'pipe' });
      spawnSync('npm', ['run', 'build'], { cwd: marketplaceDir, stdio: 'pipe' });
      logger.info('     ✅ Updated and rebuilt');
      return { success: true, message: 'Updated' };
    }

    logger.info('     Already up to date');
    return { success: true, message: 'Already up to date' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`     ❌ Update failed: ${message}`);
    return { success: false, error: message };
  }
}
