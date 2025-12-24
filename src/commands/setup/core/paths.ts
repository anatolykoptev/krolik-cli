/**
 * @module commands/setup/core/paths
 * @description Setup paths configuration
 */

import { homedir } from 'node:os';
import * as path from 'node:path';

/**
 * Claude Code directories
 */
export const CLAUDE_DIR = path.join(homedir(), '.claude');
export const PLUGINS_DIR = path.join(CLAUDE_DIR, 'plugins');
export const MARKETPLACES_DIR = path.join(PLUGINS_DIR, 'marketplaces');
export const KNOWN_MARKETPLACES_PATH = path.join(PLUGINS_DIR, 'known_marketplaces.json');
export const INSTALLED_PLUGINS_PATH = path.join(PLUGINS_DIR, 'installed_plugins.json');

/**
 * Krolik directories
 */
export const KROLIK_DIR = path.join(homedir(), '.krolik');
export const AGENTS_DIR = path.join(KROLIK_DIR, 'agents');
export const AGENTS_PLUGINS_DIR = path.join(AGENTS_DIR, 'plugins');

/**
 * Claude config paths
 */
export const CLAUDE_GLOBAL_CONFIG = path.join(homedir(), '.claude.json');

/**
 * Get project-local Claude config path
 */
export function getProjectConfigPath(projectRoot?: string): string {
  const root = projectRoot || process.cwd();
  return path.join(root, '.claude', 'settings.local.json');
}

/**
 * Get marketplace directory for a plugin
 */
export function getMarketplacePath(marketplace: string): string {
  return path.join(MARKETPLACES_DIR, marketplace);
}

/**
 * Get plugin installation path
 */
export function getPluginInstallPath(marketplace: string, pluginPath: string): string {
  return path.join(MARKETPLACES_DIR, marketplace, pluginPath);
}

/**
 * All directories that need to be created
 */
export const REQUIRED_DIRS = [CLAUDE_DIR, PLUGINS_DIR, MARKETPLACES_DIR, KROLIK_DIR];
