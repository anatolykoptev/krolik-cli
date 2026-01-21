/**
 * @module commands/agent/loader
 * @description Agent loader for wshobson/agents marketplace and workspace agents
 *
 * Loads agents from:
 * 1. wshobson/agents marketplace (plugins/)
 * 2. Workspace .agent/agents/ folder (flat structure)
 *
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

// ============================================================================
// WORKSPACE AGENTS (.agent/agents/ folder)
// ============================================================================

/**
 * Category keywords for inferring category from agent name/description
 */
const CATEGORY_KEYWORDS: Record<AgentCategory, string[]> = {
  security: ['security', 'audit', 'vulnerability', 'penetration', 'owasp', 'secure'],
  performance: ['performance', 'optimization', 'speed', 'latency', 'benchmark', 'profil'],
  architecture: ['architecture', 'design', 'pattern', 'structure', 'system', 'planner'],
  quality: ['quality', 'review', 'refactor', 'clean', 'lint'],
  debugging: ['debug', 'error', 'bug', 'issue', 'fix', 'troubleshoot'],
  docs: ['documentation', 'readme', 'api doc', 'swagger', 'comment', 'writer'],
  frontend: ['frontend', 'ui', 'ux', 'component', 'css', 'react', 'vue'],
  backend: ['backend', 'api', 'endpoint', 'server', 'specialist'],
  database: ['database', 'schema', 'query', 'migration', 'sql', 'postgres'],
  devops: ['devops', 'deploy', 'ci', 'docker', 'kubernetes', 'infrastructure'],
  testing: ['test', 'tdd', 'unit', 'integration', 'e2e'],
  other: [],
};

/**
 * Infer category from agent name and description
 */
function inferCategory(name: string, description: string): AgentCategory {
  const text = `${name} ${description}`.toLowerCase();

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (category === 'other') continue;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return category as AgentCategory;
      }
    }
  }

  return 'other';
}

/**
 * Find workspace agents path (.agent/agents/)
 */
export function findWorkspaceAgentsPath(projectRoot: string): string | null {
  // Look for .agent/agents/ in workspace root
  const workspaceAgentsPath = path.resolve(projectRoot, '.agent', 'agents');
  if (fs.existsSync(workspaceAgentsPath)) {
    return workspaceAgentsPath;
  }

  // Try parent directory (for monorepos)
  const parentAgentsPath = path.resolve(projectRoot, '..', '.agent', 'agents');
  if (fs.existsSync(parentAgentsPath)) {
    return parentAgentsPath;
  }

  return null;
}

/**
 * Parse workspace agent frontmatter (different format from plugins)
 * Workspace agents have: name, description, skills, tools, model
 */
function parseWorkspaceAgentFrontmatter(content: string): {
  name: string;
  description: string;
  model: string | undefined;
  skills: string[];
  tools: string[];
  body: string;
} {
  const result = parseMarkdownFrontmatter(content);

  // Parse skills as comma-separated or array
  let skills: string[] = [];
  if (typeof result.data.skills === 'string') {
    skills = result.data.skills.split(',').map((s: string) => s.trim());
  } else if (Array.isArray(result.data.skills)) {
    skills = result.data.skills;
  }

  // Parse tools as comma-separated or array
  let tools: string[] = [];
  if (typeof result.data.tools === 'string') {
    tools = result.data.tools.split(',').map((s: string) => s.trim());
  } else if (Array.isArray(result.data.tools)) {
    tools = result.data.tools;
  }

  return {
    name: (result.data.name as string) ?? 'unknown',
    description: (result.data.description as string) ?? '',
    model: result.data.model as string | undefined,
    skills,
    tools,
    body: result.body.trim(),
  };
}

/**
 * Parse a workspace agent file
 */
function parseWorkspaceAgentFile(filePath: string): AgentDefinition | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseWorkspaceAgentFrontmatter(content);

  // Infer category from name/description
  const category = inferCategory(parsed.name, parsed.description);

  const agentDef: AgentDefinition = {
    name: parsed.name,
    description: parsed.description,
    content: parsed.body,
    category,
    plugin: 'workspace', // Special plugin name for workspace agents
    filePath,
    componentType: 'agent',
  };

  if (parsed.model && ['sonnet', 'opus', 'haiku', 'inherit'].includes(parsed.model)) {
    agentDef.model = parsed.model as 'sonnet' | 'opus' | 'haiku' | 'inherit';
  }

  return agentDef;
}

/**
 * Load agents from workspace .agent/agents/ folder
 */
export function loadWorkspaceAgents(workspaceAgentsPath: string): AgentDefinition[] {
  if (!fs.existsSync(workspaceAgentsPath)) return [];

  const agentFiles = fs.readdirSync(workspaceAgentsPath, { withFileTypes: true });
  const agents: AgentDefinition[] = [];

  for (const file of agentFiles) {
    if (!file.isFile() || !file.name.endsWith('.md')) continue;

    const filePath = path.join(workspaceAgentsPath, file.name);
    const agent = parseWorkspaceAgentFile(filePath);
    if (agent) agents.push(agent);
  }

  return agents;
}

/**
 * Load all agents from repository (plugins only, not workspace)
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
 * Load all agents from both marketplace and workspace
 *
 * @param agentsPath - Path to wshobson/agents plugins
 * @param projectRoot - Project root for finding workspace agents
 * @returns Combined list of all agents
 */
export function loadAllAgentsWithWorkspace(
  agentsPath: string,
  projectRoot: string,
): AgentDefinition[] {
  const agents: AgentDefinition[] = [];

  // Load marketplace agents
  agents.push(...loadAllAgents(agentsPath));

  // Load workspace agents
  const workspaceAgentsPath = findWorkspaceAgentsPath(projectRoot);
  if (workspaceAgentsPath) {
    agents.push(...loadWorkspaceAgents(workspaceAgentsPath));
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
