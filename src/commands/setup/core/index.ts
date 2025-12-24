/**
 * @module commands/setup/core
 * @description Core infrastructure for setup command
 *
 * Exports:
 * - Types: SetupOptions, PluginConfig, McpServerConfig, etc.
 * - Config: PLUGINS, MCP_SERVERS registries
 * - Paths: CLAUDE_DIR, KROLIK_DIR, etc.
 */

// Types
export type {
  SetupOptions,
  PluginType,
  PluginConfig,
  McpCategory,
  McpScope,
  McpServerConfig,
  RepoStats,
  VersionInfo,
  InstallResult,
  DiagnosticsResult,
  InstallerOptions,
} from './types';

// Config
export {
  PLUGINS,
  MCP_SERVERS,
  getPlugin,
  getPluginsByType,
  getMcpServer,
  getMcpServersByCategory,
  getRequiredMcpServers,
} from './config';

// Paths
export {
  CLAUDE_DIR,
  PLUGINS_DIR,
  MARKETPLACES_DIR,
  KNOWN_MARKETPLACES_PATH,
  INSTALLED_PLUGINS_PATH,
  KROLIK_DIR,
  AGENTS_DIR,
  AGENTS_PLUGINS_DIR,
  CLAUDE_GLOBAL_CONFIG,
  getProjectConfigPath,
  getMarketplacePath,
  getPluginInstallPath,
  REQUIRED_DIRS,
} from './paths';
