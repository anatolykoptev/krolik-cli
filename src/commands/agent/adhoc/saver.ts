/**
 * @module commands/agent/adhoc/saver
 * @description Saves high-performing ad-hoc agents as permanent plugins
 *
 * When an ad-hoc agent achieves quality score >= 80, it can be saved
 * to the user's plugin directory for future use without regeneration.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { AgentCategory } from '../types';
import type { AdHocAgent, SaveAdHocAgentOptions, SaveAdHocAgentResult } from './types';

/**
 * Quality threshold for recommending save
 */
export const SAVE_QUALITY_THRESHOLD = 80;

/**
 * Default plugin directory
 */
const DEFAULT_PLUGINS_DIR = join(homedir(), '.krolik', 'agents', 'plugins');

/**
 * Map archetype to most likely category
 */
const ARCHETYPE_TO_CATEGORY: Record<string, AgentCategory> = {
  specialist: 'other',
  assistant: 'other',
  creator: 'docs',
  analyzer: 'quality',
  orchestrator: 'architecture',
};

/**
 * Generate markdown frontmatter for saved agent
 */
function generateFrontmatter(agent: AdHocAgent, category: AgentCategory): string {
  const model = agent.model || 'inherit';

  return `---
name: ${agent.name}
description: ${agent.description}
model: ${model}
category: ${category}
archetype: ${agent.archetype}
generated: true
generated_at: ${new Date().toISOString()}
focus: ${agent.focus}
expertise: [${agent.expertise.map((e) => `"${e}"`).join(', ')}]
---`;
}

/**
 * Generate complete agent markdown file
 */
function generateAgentMarkdown(agent: AdHocAgent, category: AgentCategory): string {
  const frontmatter = generateFrontmatter(agent, category);

  return `${frontmatter}

${agent.prompt}
`;
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Sanitize name for filesystem
 */
function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Save an ad-hoc agent as a permanent plugin agent
 *
 * Creates the agent in: ~/.krolik/agents/plugins/{pluginName}/agents/{agentName}.md
 */
export function saveAdHocAgent(options: SaveAdHocAgentOptions): SaveAdHocAgentResult {
  const { agent, pluginName, category } = options;
  const warnings: string[] = [];

  // Determine save path
  let pluginsDir = DEFAULT_PLUGINS_DIR;
  if (options.customPath) {
    pluginsDir = dirname(options.customPath);
  }

  const sanitizedPlugin = sanitizeName(pluginName);
  const sanitizedAgent = sanitizeName(agent.name);

  const pluginDir = join(pluginsDir, sanitizedPlugin);
  const agentsDir = join(pluginDir, 'agents');
  const filePath = options.customPath || join(agentsDir, `${sanitizedAgent}.md`);

  try {
    // Create directories
    ensureDir(agentsDir);

    // Create plugin README if not exists
    const readmePath = join(pluginDir, 'README.md');
    if (!existsSync(readmePath)) {
      const readmeContent = `# ${pluginName}

Auto-generated plugin containing agents created via Agent Architect.

## Agents

- **${agent.name}**: ${agent.description}

## Usage

\`\`\`bash
krolik agent ${sanitizedAgent}
\`\`\`
`;
      writeFileSync(readmePath, readmeContent, 'utf-8');
    }

    // Check if agent already exists
    if (existsSync(filePath)) {
      warnings.push(`Agent already exists at ${filePath}, will be overwritten`);
    }

    // Generate and write agent file
    const content = generateAgentMarkdown(agent, category);
    writeFileSync(filePath, content, 'utf-8');

    return {
      success: true,
      filePath,
      pluginName: sanitizedPlugin,
      ...(warnings.length > 0 && { warnings }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      filePath,
      pluginName: sanitizedPlugin,
      warnings: [`Failed to save agent: ${message}`],
    };
  }
}

/**
 * Determine if an ad-hoc agent should be recommended for saving
 */
export function shouldRecommendSave(qualityScore: number | undefined): boolean {
  return qualityScore !== undefined && qualityScore >= SAVE_QUALITY_THRESHOLD;
}

/**
 * Suggest category for an ad-hoc agent based on its archetype and expertise
 */
export function suggestCategory(agent: AdHocAgent): AgentCategory {
  // Check expertise for category hints
  const expertiseLower = agent.expertise.map((e) => e.toLowerCase()).join(' ');
  const focusLower = agent.focus.toLowerCase();
  const combined = `${expertiseLower} ${focusLower}`;

  if (combined.includes('security') || combined.includes('vulnerab')) {
    return 'security';
  }
  if (combined.includes('performance') || combined.includes('optim')) {
    return 'performance';
  }
  if (
    combined.includes('architect') ||
    combined.includes('design') ||
    combined.includes('system')
  ) {
    return 'architecture';
  }
  if (combined.includes('test') || combined.includes('tdd') || combined.includes('qa')) {
    return 'testing';
  }
  if (combined.includes('database') || combined.includes('sql') || combined.includes('schema')) {
    return 'database';
  }
  if (combined.includes('frontend') || combined.includes('ui') || combined.includes('react')) {
    return 'frontend';
  }
  if (combined.includes('backend') || combined.includes('api') || combined.includes('server')) {
    return 'backend';
  }
  if (combined.includes('devops') || combined.includes('ci/cd') || combined.includes('deploy')) {
    return 'devops';
  }
  if (combined.includes('doc') || combined.includes('readme') || combined.includes('write')) {
    return 'docs';
  }
  if (combined.includes('debug') || combined.includes('error') || combined.includes('bug')) {
    return 'debugging';
  }
  if (
    combined.includes('review') ||
    combined.includes('quality') ||
    combined.includes('refactor')
  ) {
    return 'quality';
  }

  // Fall back to archetype mapping
  return ARCHETYPE_TO_CATEGORY[agent.archetype] || 'other';
}

/**
 * Suggest plugin name for an ad-hoc agent
 */
export function suggestPluginName(agent: AdHocAgent): string {
  // Use expertise domain if available
  if (agent.expertise.length > 0 && agent.expertise[0]) {
    const primary = agent.expertise[0].toLowerCase().replace(/\s+/g, '-');
    return `${primary}-agents`;
  }

  // Use focus area
  const focusWords = agent.focus.toLowerCase().split(/\s+/).slice(0, 2);
  if (focusWords.length > 0) {
    return `${focusWords.join('-')}-agents`;
  }

  // Fallback
  return 'custom-agents';
}

/**
 * Format save recommendation as XML
 */
export function formatSaveRecommendationXML(agent: AdHocAgent, qualityScore: number): string {
  const category = suggestCategory(agent);
  const pluginName = suggestPluginName(agent);

  return `<save-recommendation agent="${agent.name}" quality-score="${qualityScore}">
  <reason>Agent performed well (score >= ${SAVE_QUALITY_THRESHOLD}). Consider saving for future use.</reason>
  <suggested-plugin>${pluginName}</suggested-plugin>
  <suggested-category>${category}</suggested-category>
  <command>krolik agent --save-adhoc "${agent.id}" --plugin "${pluginName}" --category "${category}"</command>
</save-recommendation>`;
}

/**
 * Format save recommendation as text
 */
export function formatSaveRecommendationText(agent: AdHocAgent, qualityScore: number): string {
  const category = suggestCategory(agent);
  const pluginName = suggestPluginName(agent);

  return `
💾 Agent "${agent.name}" performed well (score: ${qualityScore}/100)

Consider saving it for future use:
  Plugin: ${pluginName}
  Category: ${category}

  Command: krolik agent --save-adhoc "${agent.id}" --plugin "${pluginName}" --category "${category}"
`;
}
