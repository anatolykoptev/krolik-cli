/**
 * @module commands/setup/core
 * @description Core infrastructure for setup command
 *
 * Exports:
 * - Types: SetupOptions, PluginConfig, McpServerConfig, etc.
 * - Config: PLUGINS, MCP_SERVERS registries
 * - Paths: CLAUDE_DIR, KROLIK_DIR, etc.
 */

// Config
export {
  getMcpServer,
  getMcpServersByCategory,
  getPlugin,
  getPluginsByType,
  getRequiredMcpServers,
  MCP_SERVERS,
  PLUGINS,
} from './config';
// Paths
export {
  AGENTS_DIR,
  AGENTS_PLUGINS_DIR,
  CLAUDE_DIR,
  CLAUDE_GLOBAL_CONFIG,
  getMarketplacePath,
  getPluginInstallPath,
  getProjectConfigPath,
  INSTALLED_PLUGINS_PATH,
  KNOWN_MARKETPLACES_PATH,
  KROLIK_DIR,
  MARKETPLACES_DIR,
  PLUGINS_DIR,
  REQUIRED_DIRS,
} from './paths';
// Types
export type {
  DiagnosticsResult,
  InstallerOptions,
  InstallResult,
  McpCategory,
  McpScope,
  McpServerConfig,
  PluginConfig,
  PluginType,
  RepoStats,
  SetupOptions,
  VersionInfo,
} from './types';
