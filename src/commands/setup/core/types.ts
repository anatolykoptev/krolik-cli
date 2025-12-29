/**
 * @module commands/setup/core/types
 * @description Setup command types
 */

import type { RepoStats } from '../../../lib/@agents';
import type { VersionInfo } from '../../../lib/@git';
import type { CommandContext } from '../../../types';

// Re-export shared types from lib
export type { RepoStats, VersionInfo };

/**
 * Setup command options
 */
export interface SetupOptions {
  all?: boolean;
  plugins?: boolean;
  agents?: boolean;
  mem?: boolean;
  mcp?: boolean | string;
  i18n?: boolean;
  update?: boolean;
  check?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Plugin installation type
 */
export type PluginType = 'mcp-plugin' | 'claude-plugins';

/**
 * Plugin configuration
 */
export interface PluginConfig {
  id: string;
  name: string;
  description: string;
  repo: string;
  marketplace: string;
  pluginPath: string;
  type: PluginType;
}

/**
 * MCP server priority category
 */
export type McpCategory = 'essential' | 'recommended' | 'optional';

/**
 * MCP server scope
 */
export type McpScope = 'global' | 'project';

/**
 * MCP server configuration
 */
export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  category: McpCategory;
  scope: McpScope;
}

/**
 * Installation result
 */
export interface InstallResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Diagnostics result
 */
export interface DiagnosticsResult {
  plugins: {
    claudeMem: { installed: boolean; path?: string };
    agents: { installed: boolean; version?: string; stats?: RepoStats };
  };
  mcpServers: {
    installed: string[];
    missing: string[];
    recommended: string[];
  };
  recommendations: string[];
}

/**
 * Installer options
 */
export interface InstallerOptions {
  dryRun: boolean;
  force?: boolean;
  logger: CommandContext['logger'];
}
