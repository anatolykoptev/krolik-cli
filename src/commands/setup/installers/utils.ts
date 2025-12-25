/**
 * @module commands/setup/installers/utils
 * @description Shared utilities for installers
 *
 * Uses shared agents utilities from lib/@agents
 */

import * as fs from 'node:fs';
import { homedir } from 'node:os';
import * as path from 'node:path';
import type { RepoStats } from '../../../lib/@agents';
import {
  getAgentsHome,
  getAgentsPluginsDir,
  getAgentsVersion,
  getRepoStats,
} from '../../../lib/@agents';
import type { VersionInfo } from '../../../lib/@git';
import { isGitAvailable } from '../../../lib/@git';
import {
  INSTALLED_PLUGINS_PATH,
  KNOWN_MARKETPLACES_PATH,
  MARKETPLACES_DIR,
  REQUIRED_DIRS,
} from '../core/paths';
import type { PluginConfig } from '../core/types';

// Re-export from shared lib
export type { RepoStats, VersionInfo };
export { getAgentsHome, getAgentsPluginsDir, getAgentsVersion, isGitAvailable };

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
  for (const dir of REQUIRED_DIRS) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

/**
 * Register marketplace in known_marketplaces.json
 */
export function registerMarketplace(plugin: PluginConfig): void {
  let marketplaces: Record<string, unknown> = {};

  if (fs.existsSync(KNOWN_MARKETPLACES_PATH)) {
    try {
      marketplaces = JSON.parse(fs.readFileSync(KNOWN_MARKETPLACES_PATH, 'utf8'));
    } catch {
      // Invalid JSON, start fresh
    }
  }

  marketplaces[plugin.marketplace] = {
    source: {
      source: 'github',
      repo: plugin.repo,
    },
    installLocation: path.join(MARKETPLACES_DIR, plugin.marketplace),
    lastUpdated: new Date().toISOString(),
  };

  fs.writeFileSync(KNOWN_MARKETPLACES_PATH, JSON.stringify(marketplaces, null, 2));
}

/**
 * Register plugin in installed_plugins.json
 */
export function registerPlugin(plugin: PluginConfig, installLocation: string): void {
  let installed: { version: number; plugins: Record<string, unknown> } = {
    version: 2,
    plugins: {},
  };

  if (fs.existsSync(INSTALLED_PLUGINS_PATH)) {
    try {
      installed = JSON.parse(fs.readFileSync(INSTALLED_PLUGINS_PATH, 'utf8'));
    } catch {
      // Invalid JSON, start fresh
    }
  }

  installed.plugins[plugin.name] = {
    marketplace: plugin.marketplace,
    path: plugin.pluginPath,
    installLocation,
    installedAt: new Date().toISOString(),
  };

  fs.writeFileSync(INSTALLED_PLUGINS_PATH, JSON.stringify(installed, null, 2));
}

/**
 * Get stats for agents repository
 * Wrapper around shared getRepoStats using agents plugins path
 */
export function getAgentsRepoStats(): RepoStats {
  return getRepoStats(getAgentsPluginsDir());
}

/**
 * Create data directory for claude-mem
 */
export function ensureClaudeMemDataDir(): void {
  const dataDir = path.join(homedir(), '.claude-mem');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}
