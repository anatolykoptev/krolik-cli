/**
 * @module commands/agent
 * @description Agent command - run specialized AI agents with project context
 *
 * Supports two modes:
 * 1. Direct mode: Run a specific agent by name
 * 2. Orchestration mode: Analyze task and coordinate multiple agents
 */

import type { CommandContext } from '../../types/commands/base';
import { AGENT_CATEGORIES, resolveCategory } from './categories';
import { LIMITS } from './constants';
import {
  cloneAgentsRepo,
  findAgentsPath,
  getAgentCountByCategory,
  getAgentsVersion,
  getRepoStats,
  loadAgentByName,
  loadAgentsByCategory,
  loadAllAgents,
  updateAgentsRepo,
} from './loader';
import { formatAgentListAI, formatAgentListText } from './output';
import { runOrchestration, runSingleAgent } from './runners';
import type { AgentCategory, AgentOptions } from './types';

/**
 * Agent command options (extended)
 */
export interface AgentCommandOptions extends AgentOptions {
  agentName?: string;
  install?: boolean;
  update?: boolean;
  // Orchestration options
  orchestrate?: boolean;
  task?: string;
  maxAgents?: number;
  preferParallel?: boolean;
}

/**
 * Handle --install flag
 */
function handleInstall(logger: CommandContext['logger']): void {
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
}

/**
 * Handle --update flag
 */
function handleUpdate(logger: CommandContext['logger']): void {
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
}

/**
 * Ensure agents are installed, auto-install if needed
 */
function ensureAgentsInstalled(projectRoot: string, logger: CommandContext['logger']): string {
  const agentsPath = findAgentsPath(projectRoot);
  if (agentsPath) return agentsPath;

  logger.info('Agents not found. Installing wshobson/agents...');
  const result = cloneAgentsRepo();
  if (!result.success) {
    logger.error(result.error || 'Failed to install agents');
    logger.info(
      'You can manually install: git clone https://github.com/wshobson/agents ~/.krolik/agents',
    );
    process.exit(1);
  }
  if (!result.path) {
    logger.error('Failed to get agents path after installation');
    process.exit(1);
  }
  return result.path;
}

/**
 * Handle agent not found - suggest similar agents
 */
function handleAgentNotFound(
  agentsPath: string,
  agentName: string,
  logger: CommandContext['logger'],
): never {
  logger.error(`Agent "${agentName}" not found`);
  logger.info('Use --list to see available agents');

  const allAgents = loadAllAgents(agentsPath);
  const similar = allAgents.filter(
    (a) =>
      a.name.includes(agentName) ||
      agentName.includes(a.name) ||
      a.description.toLowerCase().includes(agentName.toLowerCase()),
  );
  if (similar.length > 0) {
    logger.info(
      `\nDid you mean: ${similar
        .slice(0, LIMITS.SIMILAR_AGENTS)
        .map((a) => a.name)
        .join(', ')}`,
    );
  }
  process.exit(1);
}

/**
 * Run agent command
 */
export async function runAgent(
  ctx: CommandContext & { options: AgentCommandOptions },
): Promise<void> {
  const { config, logger, options } = ctx;
  const projectRoot = config.projectRoot;

  if (options.install) {
    handleInstall(logger);
    return;
  }

  if (options.update) {
    handleUpdate(logger);
    return;
  }

  const agentsPath = ensureAgentsInstalled(projectRoot, logger);

  if (options.list) {
    const version = getAgentsVersion();
    if (version) {
      console.log(`<!-- Agents: ${version.version} (${version.date}) -->`);
    }
    await listAgents(agentsPath, options);
    return;
  }

  if (options.orchestrate) {
    const task = options.task || options.agentName || 'analyze the project';
    await runOrchestration(projectRoot, task, options);
    return;
  }

  const agentName = options.agentName;
  if (!agentName) {
    logger.error('Agent name is required');
    logger.info('Usage: krolik agent <name> [options]');
    logger.info('Use --list to see available agents');
    logger.info('Use --orchestrate --task "..." for multi-agent mode');
    process.exit(1);
  }

  const category = resolveCategory(agentName);
  if (category) {
    await runCategoryAgents(agentsPath, category, projectRoot, options);
    return;
  }

  const agent = loadAgentByName(agentsPath, agentName);
  if (!agent) {
    handleAgentNotFound(agentsPath, agentName, logger);
  }

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
  const agentsToRun =
    primaryAgents.length > 0 ? primaryAgents : agents.slice(0, LIMITS.DEFAULT_AGENTS_TO_RUN);

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

export { AGENT_CATEGORIES, resolveCategory } from './categories';
export {
  findAgentsPath,
  getRepoStats,
  loadAgentByName,
  loadAgentsByCategory,
  loadAllAgents,
} from './loader';
// Re-export orchestration
export {
  type AgentRecommendation,
  analyzeTask,
  BUILTIN_AGENTS,
  createExecutionPlan,
  type ExecutionPhase,
  type ExecutionPlan,
  type ExecutionStrategy,
  formatOrchestrationJSON,
  formatOrchestrationText,
  formatOrchestrationXML,
  getAgentRecommendations,
  ORCHESTRATOR_AGENT,
  type OrchestrateOptions,
  type OrchestrationResult,
  orchestrate,
  TASK_ROUTER_AGENT,
  type TaskAnalysis,
  type TaskType,
} from './orchestrator';
// Re-export types
export type {
  AgentCategory,
  AgentDefinition,
  AgentOptions,
  AgentResult,
  ComponentType,
  RepoStats,
} from './types';
