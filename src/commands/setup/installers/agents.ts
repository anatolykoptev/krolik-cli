/**
 * @module commands/setup/installers/agents
 * @description Agents repository installer (wshobson/agents)
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getPlugin } from '../core/config';
import { AGENTS_DIR, AGENTS_PLUGINS_DIR } from '../core/paths';
import type { InstallerOptions, InstallResult } from '../core/types';
import { getAgentsVersion, isGitAvailable } from './utils';

const AGENTS_REPO = 'https://github.com/wshobson/agents.git';

/**
 * Install agents repository (clone only, no npm)
 */
export async function installAgentsRepo(opts: InstallerOptions): Promise<InstallResult> {
  const { dryRun, force = false, logger } = opts;
  const plugin = getPlugin('wshobson-agents');

  if (!plugin) {
    return { success: false, error: 'Plugin config not found' };
  }

  logger.info(`  🤖 ${plugin.name}`);
  logger.info(`     ${plugin.description}`);

  // Check if already installed
  if (fs.existsSync(AGENTS_PLUGINS_DIR) && !force) {
    const version = getAgentsVersion();
    if (version) {
      logger.info(`     ⏭️  Already installed (${version.version})`);
      logger.info(`     Use --force to reinstall or --update to update`);
    } else {
      logger.info(`     ⏭️  Already installed (use --force to reinstall)`);
    }
    return { success: true, message: 'Already installed' };
  }

  // Check git availability
  if (!isGitAvailable()) {
    return {
      success: false,
      error: 'Git is not installed. Please install git and try again.',
    };
  }

  if (dryRun) {
    logger.info(`     [DRY RUN] Would clone ${plugin.repo}`);
    logger.info(`     [DRY RUN] Would install to ${AGENTS_DIR}`);
    return { success: true, message: 'Dry run' };
  }

  try {
    logger.info(`     Cloning from GitHub...`);

    // Remove existing directory if force
    if (fs.existsSync(AGENTS_DIR) && force) {
      fs.rmSync(AGENTS_DIR, { recursive: true });
    }

    const cloneResult = spawnSync('git', ['clone', '--depth', '1', AGENTS_REPO, AGENTS_DIR], {
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 60000,
    });

    if (cloneResult.status !== 0) {
      throw new Error(cloneResult.stderr || 'Clone failed');
    }

    const version = getAgentsVersion();
    if (version) {
      logger.info(`     ✅ Installed (${version.version})`);
    } else {
      logger.info(`     ✅ Installed successfully`);
    }
    return { success: true, message: 'Installed' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`     ❌ Failed: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Update agents repository
 */
export async function updateAgentsRepo(opts: InstallerOptions): Promise<InstallResult> {
  const { dryRun, logger } = opts;

  if (!fs.existsSync(path.join(AGENTS_DIR, '.git'))) {
    logger.info('  🤖 Agents not installed (run krolik setup --agents)');
    return { success: false, error: 'Not installed' };
  }

  logger.info('  🤖 Updating agents...');

  if (dryRun) {
    logger.info('     [DRY RUN] Would run git pull');
    return { success: true, message: 'Dry run' };
  }

  try {
    spawnSync('git', ['fetch', 'origin'], {
      cwd: AGENTS_DIR,
      stdio: 'pipe',
      timeout: 30000,
    });

    const statusResult = spawnSync('git', ['status', '-uno'], {
      cwd: AGENTS_DIR,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    if (statusResult.stdout?.includes('behind')) {
      const pullResult = spawnSync('git', ['pull', '--ff-only'], {
        cwd: AGENTS_DIR,
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 60000,
      });

      if (pullResult.status === 0) {
        const version = getAgentsVersion();
        logger.info(`     ✅ Updated to ${version?.version || 'latest'}`);
        return { success: true, message: 'Updated' };
      }

      throw new Error(pullResult.stderr || 'Pull failed');
    }

    logger.info('     Already up to date');
    return { success: true, message: 'Already up to date' };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`     ❌ Update failed: ${message}`);
    return { success: false, error: message };
  }
}
