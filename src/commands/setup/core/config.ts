/**
 * @module commands/setup/core/config
 * @description Plugin and MCP server configurations
 */

import type { PluginConfig, McpServerConfig } from './types';

/**
 * Available plugins registry
 */
export const PLUGINS: PluginConfig[] = [
  {
    id: 'claude-mem',
    name: 'claude-mem',
    description: 'Persistent memory for Claude Code sessions',
    repo: 'thedotmack/claude-mem',
    marketplace: 'thedotmack',
    pluginPath: 'plugin',
    type: 'mcp-plugin',
  },
  {
    id: 'wshobson-agents',
    name: 'wshobson-agents',
    description: 'Claude Code plugins with specialized agents, commands, and skills',
    repo: 'wshobson/agents',
    marketplace: 'wshobson',
    pluginPath: 'plugins',
    type: 'claude-plugins',
  },
];

/**
 * Get plugin by ID
 */
export function getPlugin(id: string): PluginConfig | undefined {
  return PLUGINS.find((p) => p.id === id);
}

/**
 * Get plugins by type
 */
export function getPluginsByType(type: PluginConfig['type']): PluginConfig[] {
  return PLUGINS.filter((p) => p.type === type);
}

/**
 * Available MCP servers registry
 */
export const MCP_SERVERS: McpServerConfig[] = [
  {
    id: 'krolik',
    name: 'krolik',
    description: 'AI development toolkit (schema, routes, context, review)',
    command: 'npx',
    args: ['krolik', 'mcp'],
    category: 'essential',
    scope: 'project',
  },
  {
    id: 'context7',
    name: 'context7',
    description: 'Up-to-date library documentation and code examples',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest'],
    category: 'essential',
    scope: 'global',
  },
  {
    id: 'sequential-thinking',
    name: 'sequential-thinking',
    description: 'Dynamic problem-solving through step-by-step analysis',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-sequential-thinking'],
    category: 'recommended',
    scope: 'global',
  },
  {
    id: 'perplexity',
    name: 'perplexity',
    description: 'Web search and deep research with Perplexity AI',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-perplexity'],
    category: 'recommended',
    scope: 'global',
  },
  {
    id: 'brave-search',
    name: 'brave-search',
    description: 'Web and local search using Brave Search API',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-brave-search'],
    category: 'optional',
    scope: 'global',
  },
  {
    id: 'fetch',
    name: 'fetch',
    description: 'Fetch and process web content as markdown',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-fetch'],
    category: 'optional',
    scope: 'global',
  },
  {
    id: 'playwright',
    name: 'playwright',
    description: 'Browser automation and testing',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-playwright'],
    category: 'optional',
    scope: 'global',
  },
  {
    id: 'github',
    name: 'github',
    description: 'GitHub API integration (issues, PRs, repos)',
    command: 'npx',
    args: ['-y', '@anthropic/mcp-github'],
    category: 'recommended',
    scope: 'global',
  },
];

/**
 * Get MCP server by ID
 */
export function getMcpServer(id: string): McpServerConfig | undefined {
  return MCP_SERVERS.find((s) => s.id === id);
}

/**
 * Get MCP servers by category
 */
export function getMcpServersByCategory(category: McpServerConfig['category']): McpServerConfig[] {
  return MCP_SERVERS.filter((s) => s.category === category);
}

/**
 * Get all non-optional MCP servers
 */
export function getRequiredMcpServers(): McpServerConfig[] {
  return MCP_SERVERS.filter((s) => s.category !== 'optional');
}
