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

// Agents installer
export { installAgentsRepo, updateAgentsRepo } from './agents';

// MCP Plugin installer
export { installMcpPlugin, updateMcpPlugin } from './mcp-plugin';
// MCP Server installer
export {
  getInstalledMcpServers,
  installAllMcpServers,
  installMcpServer,
  isMcpServerInstalled,
} from './mcp-server';
// Utils
export {
  ensureClaudeMemDataDir,
  ensureDirectories,
  getAgentsRepoStats,
  getAgentsVersion,
  isGitAvailable,
  registerMarketplace,
  registerPlugin,
} from './utils';
