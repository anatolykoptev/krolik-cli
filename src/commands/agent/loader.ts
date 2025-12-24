/**
 * @module commands/agent/loader
 * @description Agent loader for wshobson/agents marketplace
 *
 * Loads agents, commands, and skills from the repository.
 * See types.ts for terminology definitions.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AgentDefinition, AgentCategory } from './types';
import { getCategoryForPlugin } from './categories';

// Import shared utilities from lib
import {
  getKrolikHome,
  getAgentsHome,
  getAgentsPluginsDir,
  isGitAvailable,
  getGitVersion,
  cloneRepo,
  pullRepo,
  AGENTS_REPO_URL,
} from '../../lib/@agents';

import { parseFrontmatter as parseMarkdownFrontmatter } from '../../lib/@markdown';

// Re-export shared utilities for backward compatibility
export { getRepoStats } from '../../lib/@agents';
export type { RepoStats, VersionInfo } from '../../lib/@agents';

/**
 * Default path for development
 */
const DEFAULT_AGENTS_PATH = '../agents/plugins';

/**
 * Clone agents repository to ~/.krolik/agents
 */
export function cloneAgentsRepo(): { success: boolean; path: string; error?: string } {
  const agentsHome = getAgentsHome();
  const krolikHome = getKrolikHome();

  // Ensure ~/.krolik exists
  if (!fs.existsSync(krolikHome)) {
    fs.mkdirSync(krolikHome, { recursive: true });
  }

  // Check if already cloned
  if (fs.existsSync(path.join(agentsHome, 'plugins'))) {
    return { success: true, path: path.join(agentsHome, 'plugins') };
  }

  // Check git availability
  if (!isGitAvailable()) {
    return {
      success: false,
      path: '',
      error: 'Git is not installed. Please install git and try again.',
    };
  }

  const result = cloneRepo(AGENTS_REPO_URL, agentsHome);

  if (result.success) {
    console.log(`✅ Agents installed to ${agentsHome}`);
    return { success: true, path: path.join(agentsHome, 'plugins') };
  }

  return { success: false, path: '', error: `Failed to clone agents: ${result.error}` };
}

/**
 * Update agents repository
 */
export function updateAgentsRepo(): { success: boolean; updated: boolean; error?: string } {
  const agentsHome = getAgentsHome();

  if (!fs.existsSync(path.join(agentsHome, '.git'))) {
    return { success: false, updated: false, error: 'Agents not installed. Run krolik agent --install first.' };
  }

  const result = pullRepo(agentsHome);

  if (result.success && result.updated) {
    console.log('✅ Agents updated');
  }

  return result;
}

/**
 * Get agents version info
 * Wrapper around shared getGitVersion
 */
export function getAgentsVersion(): { version: string; date: string } | null {
  return getGitVersion(getAgentsHome());
}

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
 * Load all agents from repository
 */
export function loadAllAgents(agentsPath: string): AgentDefinition[] {
  const agents: AgentDefinition[] = [];

  if (!fs.existsSync(agentsPath)) {
    return agents;
  }

  const plugins = fs.readdirSync(agentsPath, { withFileTypes: true });

  for (const plugin of plugins) {
    if (!plugin.isDirectory()) continue;

    const pluginPath = path.join(agentsPath, plugin.name);
    const agentsDir = path.join(pluginPath, 'agents');

    if (!fs.existsSync(agentsDir)) continue;

    const agentFiles = fs.readdirSync(agentsDir, { withFileTypes: true });

    for (const file of agentFiles) {
      if (!file.isFile() || !file.name.endsWith('.md')) continue;
      if (file.name === 'SKILL.md') continue; // Skip skill files

      const filePath = path.join(agentsDir, file.name);
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = parseFrontmatter(content);

      const agentDef: AgentDefinition = {
        name: parsed.name,
        description: parsed.description,
        content: parsed.body,
        category: getCategoryForPlugin(plugin.name),
        plugin: plugin.name,
        filePath,
        componentType: 'agent',
      };

      // Only add model if it's a valid value
      if (parsed.model && ['sonnet', 'opus', 'haiku', 'inherit'].includes(parsed.model)) {
        agentDef.model = parsed.model as 'sonnet' | 'opus' | 'haiku' | 'inherit';
      }

      agents.push(agentDef);
    }
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
export function getAgentCountByCategory(
  agentsPath: string,
): Record<AgentCategory, number> {
  const allAgents = loadAllAgents(agentsPath);
  const counts: Record<string, number> = {};

  for (const agent of allAgents) {
    counts[agent.category] = (counts[agent.category] || 0) + 1;
  }

  return counts as Record<AgentCategory, number>;
}
