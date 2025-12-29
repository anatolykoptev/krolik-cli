/**
 * @module commands/agent/loader
 * @description Agent loader for wshobson/agents marketplace
 *
 * Loads agents, commands, and skills from the repository.
 * See types.ts for terminology definitions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
// Import shared utilities from lib
import {
  cloneAgentsRepo,
  getAgentsPluginsDir,
  getAgentsVersion,
  getRepoStats,
  type RepoStats,
  updateAgentsRepo,
  type VersionInfo,
} from '../../lib/@agents';
import { parseFrontmatter as parseMarkdownFrontmatter } from '../../lib/@format';
import { getCategoryForPlugin } from './categories';
import type { AgentCategory, AgentDefinition } from './types';

// Re-export shared utilities for backward compatibility
export { cloneAgentsRepo, getAgentsVersion, getRepoStats, updateAgentsRepo };
export type { RepoStats, VersionInfo };

/**
 * Default path for development
 */
const DEFAULT_AGENTS_PATH = '../agents/plugins';

/**
 * Parse agent frontmatter from markdown content
 * Uses shared lib/@markdown/frontmatter utilities
 */
function parseFrontmatter(content: string): {
  name: string;
  description: string;
  model: string | undefined;
  body: string;
} {
  const result = parseMarkdownFrontmatter(content);

  return {
    name: (result.data.name as string) ?? 'unknown',
    description: (result.data.description as string) ?? '',
    model: result.data.model as string | undefined,
    body: result.body.trim(),
  };
}

/**
 * Find agents repository path
 */
export function findAgentsPath(projectRoot: string): string | null {
  // Try relative path first (for development)
  const relativePath = path.resolve(projectRoot, DEFAULT_AGENTS_PATH);
  if (fs.existsSync(relativePath)) {
    return relativePath;
  }

  // Try absolute path in workspace
  const workspacePath = path.resolve(projectRoot, '..', 'agents', 'plugins');
  if (fs.existsSync(workspacePath)) {
    return workspacePath;
  }

  // Try home directory
  const homePath = getAgentsPluginsDir();
  if (fs.existsSync(homePath)) {
    return homePath;
  }

  return null;
}

/**
 * Parse a single agent file and create AgentDefinition
 */
function parseAgentFile(filePath: string, pluginName: string): AgentDefinition | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseFrontmatter(content);

  const agentDef: AgentDefinition = {
    name: parsed.name,
    description: parsed.description,
    content: parsed.body,
    category: getCategoryForPlugin(pluginName),
    plugin: pluginName,
    filePath,
    componentType: 'agent',
  };

  if (parsed.model && ['sonnet', 'opus', 'haiku', 'inherit'].includes(parsed.model)) {
    agentDef.model = parsed.model as 'sonnet' | 'opus' | 'haiku' | 'inherit';
  }

  return agentDef;
}

/**
 * Load agents from a single plugin directory
 */
function loadAgentsFromPlugin(agentsPath: string, pluginName: string): AgentDefinition[] {
  const agentsDir = path.join(agentsPath, pluginName, 'agents');
  if (!fs.existsSync(agentsDir)) return [];

  const agentFiles = fs.readdirSync(agentsDir, { withFileTypes: true });
  const agents: AgentDefinition[] = [];

  for (const file of agentFiles) {
    if (!file.isFile() || !file.name.endsWith('.md')) continue;
    if (file.name === 'SKILL.md') continue;

    const filePath = path.join(agentsDir, file.name);
    const agent = parseAgentFile(filePath, pluginName);
    if (agent) agents.push(agent);
  }

  return agents;
}

/**
 * Load all agents from repository
 */
export function loadAllAgents(agentsPath: string): AgentDefinition[] {
  if (!fs.existsSync(agentsPath)) return [];

  const plugins = fs.readdirSync(agentsPath, { withFileTypes: true });
  const agents: AgentDefinition[] = [];

  for (const plugin of plugins) {
    if (!plugin.isDirectory()) continue;
    agents.push(...loadAgentsFromPlugin(agentsPath, plugin.name));
  }

  return agents;
}

/**
 * Load agents by category
 */
export function loadAgentsByCategory(
  agentsPath: string,
  category: AgentCategory,
): AgentDefinition[] {
  const allAgents = loadAllAgents(agentsPath);
  return allAgents.filter((agent) => agent.category === category);
}

/**
 * Load a specific agent by name
 */
export function loadAgentByName(agentsPath: string, name: string): AgentDefinition | null {
  const allAgents = loadAllAgents(agentsPath);
  return allAgents.find((agent) => agent.name === name) || null;
}

/**
 * Search agents by query
 */
export function searchAgents(agentsPath: string, query: string): AgentDefinition[] {
  const allAgents = loadAllAgents(agentsPath);
  const normalized = query.toLowerCase();

  return allAgents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(normalized) ||
      agent.description.toLowerCase().includes(normalized) ||
      agent.plugin.toLowerCase().includes(normalized),
  );
}

/**
 * Get agent count by category
 */
export function getAgentCountByCategory(agentsPath: string): Record<AgentCategory, number> {
  const allAgents = loadAllAgents(agentsPath);
  const counts: Record<string, number> = {};

  for (const agent of allAgents) {
    counts[agent.category] = (counts[agent.category] || 0) + 1;
  }

  return counts as Record<AgentCategory, number>;
}
