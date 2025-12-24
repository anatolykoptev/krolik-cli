/**
 * @module commands/agent
 * @description Agent command - run specialized AI agents with project context
 */

import type { CommandContext } from '../../types';
import type { AgentOptions, AgentDefinition, AgentResult, AgentCategory } from './types';
import {
  findAgentsPath,
  loadAllAgents,
  loadAgentsByCategory,
  loadAgentByName,
  getAgentCountByCategory,
  getRepoStats,
  cloneAgentsRepo,
  updateAgentsRepo,
  getAgentsVersion,
} from './loader';
import { buildAgentContext, formatContextForPrompt } from './context';
import { resolveCategory, AGENT_CATEGORIES } from './categories';
import {
  formatAgentListText,
  formatAgentListAI,
  formatResultText,
} from './output';
import { measureTime } from '../../lib';
import { escapeXml } from '../../lib';

/**
 * Agent command options (extended)
 */
export interface AgentCommandOptions extends AgentOptions {
  agentName?: string;
  install?: boolean;
  update?: boolean;
}

/**
 * Run agent command
 */
export async function runAgent(
  ctx: CommandContext & { options: AgentCommandOptions },
): Promise<void> {
  const { config, logger, options } = ctx;
  const projectRoot = config.projectRoot;

  // Handle --install flag (redirect to setup --agents)
  if (options.install) {
    logger.info('Hint: Use "krolik setup --agents" instead');
    const result = cloneAgentsRepo();
    if (!result.success) {
      logger.error(result.error || 'Failed to install agents');
      process.exit(1);
    }
    const version = getAgentsVersion();
    if (version) {
      logger.info(`Agents version: ${version.version} (${version.date})`);
    }
    return;
  }

  // Handle --update flag (redirect to setup --update)
  if (options.update) {
    logger.info('Hint: Use "krolik setup --update" instead');
    const result = updateAgentsRepo();
    if (!result.success) {
      logger.error(result.error || 'Failed to update agents');
      process.exit(1);
    }
    if (result.updated) {
      logger.info('Agents updated successfully');
    } else {
      logger.info('Agents are already up to date');
    }
    return;
  }

  // Find agents repository
  let agentsPath = findAgentsPath(projectRoot);

  // Auto-install if not found
  if (!agentsPath) {
    logger.info('Agents not found. Installing wshobson/agents...');
    const result = cloneAgentsRepo();
    if (!result.success) {
      logger.error(result.error || 'Failed to install agents');
      logger.info('You can manually install: git clone https://github.com/wshobson/agents ~/.krolik/agents');
      process.exit(1);
    }
    agentsPath = result.path;
  }

  // Handle --list flag
  if (options.list) {
    const version = getAgentsVersion();
    if (version) {
      console.log(`<!-- Agents: ${version.version} (${version.date}) -->`);
    }
    await listAgents(agentsPath, options);
    return;
  }

  // Get agent name from options
  const agentName = options.agentName;
  if (!agentName) {
    logger.error('Agent name is required');
    logger.info('Usage: krolik agent <name> [options]');
    logger.info('Use --list to see available agents');
    process.exit(1);
  }

  // Try to resolve as category first
  const category = resolveCategory(agentName);
  if (category) {
    await runCategoryAgents(agentsPath, category, projectRoot, options);
    return;
  }

  // Try to find specific agent
  const agent = loadAgentByName(agentsPath, agentName);
  if (!agent) {
    logger.error(`Agent "${agentName}" not found`);
    logger.info('Use --list to see available agents');

    // Suggest similar agents
    const allAgents = loadAllAgents(agentsPath);
    const similar = allAgents.filter(
      (a) =>
        a.name.includes(agentName) ||
        agentName.includes(a.name) ||
        a.description.toLowerCase().includes(agentName.toLowerCase()),
    );
    if (similar.length > 0) {
      logger.info(`\nDid you mean: ${similar.slice(0, 5).map((a) => a.name).join(', ')}`);
    }
    process.exit(1);
  }

  // Run single agent
  await runSingleAgent(agent, projectRoot, options);
}

/**
 * List available agents
 */
async function listAgents(agentsPath: string, options: AgentOptions): Promise<void> {
  const agents = loadAllAgents(agentsPath);
  const counts = getAgentCountByCategory(agentsPath);
  const stats = getRepoStats(agentsPath);

  // Filter by category if specified
  let filteredAgents = agents;
  if (options.category) {
    filteredAgents = agents.filter((a) => a.category === options.category);
  }

  // Sort by category, then by name
  filteredAgents.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  const format = options.format ?? 'ai';

  if (format === 'text') {
    console.log(formatAgentListText(filteredAgents, counts, stats));
  } else {
    console.log(formatAgentListAI(filteredAgents, counts, stats));
  }
}

/**
 * Run all agents in a category
 */
async function runCategoryAgents(
  agentsPath: string,
  category: AgentCategory,
  projectRoot: string,
  options: AgentOptions,
): Promise<void> {
  const categoryInfo = AGENT_CATEGORIES[category];
  const agents = loadAgentsByCategory(agentsPath, category);

  // Filter to primary agents only
  const primaryAgents = agents.filter((a) => categoryInfo.primaryAgents.includes(a.name));
  const agentsToRun = primaryAgents.length > 0 ? primaryAgents : agents.slice(0, 3);

  console.log(`<agent-category name="${category}">`);
  console.log(`  <label>${categoryInfo.label}</label>`);
  console.log(`  <description>${categoryInfo.description}</description>`);
  console.log(`  <agents-count>${agentsToRun.length}</agents-count>`);
  console.log('');

  for (const agent of agentsToRun) {
    await runSingleAgent(agent, projectRoot, options, true);
  }

  console.log('</agent-category>');
}

/**
 * Run a single agent
 */
async function runSingleAgent(
  agent: AgentDefinition,
  projectRoot: string,
  options: AgentOptions,
  nested = false,
): Promise<void> {
  const { result: context, durationMs: contextDurationMs } = measureTime(() =>
    buildAgentContext(projectRoot, options),
  );

  const awaitedContext = await context;
  const contextPrompt = formatContextForPrompt(awaitedContext);

  // Build full prompt
  const fullPrompt = `${agent.content}

${contextPrompt}

Please analyze the project and provide your findings.`;

  // Create result
  const result: AgentResult = {
    agent: agent.name,
    category: agent.category,
    success: true,
    output: '', // Will be filled by Claude
    durationMs: contextDurationMs,
  };

  const format = options.format ?? 'ai';
  const indent = nested ? '  ' : '';

  // Output agent prompt for Claude to execute
  if (format === 'text') {
    console.log(`${indent}${formatResultText(result)}`);
    console.log(`${indent}--- Agent Prompt ---`);
    console.log(fullPrompt);
  } else {
    console.log(`${indent}<agent-execution name="${agent.name}" category="${agent.category}">`);
    console.log(`${indent}  <description>${escapeXml(agent.description)}</description>`);
    if (agent.model) {
      console.log(`${indent}  <model>${agent.model}</model>`);
    }
    console.log(`${indent}  <prompt>`);
    console.log(escapeXml(fullPrompt));
    console.log(`${indent}  </prompt>`);
    console.log(`${indent}  <context-duration-ms>${contextDurationMs}</context-duration-ms>`);
    console.log(`${indent}</agent-execution>`);
  }
}

// Re-export types
export type { AgentOptions, AgentDefinition, AgentResult, AgentCategory, RepoStats, ComponentType } from './types';
export { AGENT_CATEGORIES, resolveCategory } from './categories';
export { loadAllAgents, loadAgentByName, loadAgentsByCategory, getRepoStats } from './loader';
