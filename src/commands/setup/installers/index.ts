/**
 * @module commands/setup/installers
 * @description Setup installers for plugins, agents, and MCP servers
 *
 * Exports:
 * - MCP Plugins: installMcpPlugin, updateMcpPlugin
 * - Agents: installAgentsRepo, updateAgentsRepo
 * - MCP Servers: installMcpServer, installAllMcpServers
 * - Utils: ensureDirectories, getAgentsVersion, getAgentsRepoStats
 */

// Utils
export {
  ensureDirectories,
  isGitAvailable,
  registerMarketplace,
  registerPlugin,
  getAgentsVersion,
  getAgentsRepoStats,
  ensureClaudeMemDataDir,
} from './utils';

// MCP Plugin installer
export { installMcpPlugin, updateMcpPlugin } from './mcp-plugin';

// Agents installer
export { installAgentsRepo, updateAgentsRepo } from './agents';

// MCP Server installer
export {
  getInstalledMcpServers,
  isMcpServerInstalled,
  installMcpServer,
  installAllMcpServers,
} from './mcp-server';
