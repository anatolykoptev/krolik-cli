/**
 * @module commands/agent/orchestrator/execution-plan
 * @description Execution plan creation for agent orchestration
 *
 * Supports two selection modes:
 * - Legacy: Hardcoded primaryAgents lists (default)
 * - Smart: Context-aware scoring with history (--smart-selection flag)
 *
 * When no suitable agents are found or task requires agent creation,
 * recommends Agent Architect to design a new specialized agent.
 */

import { AGENT_CATEGORIES } from '../categories';
import { LIMITS } from '../constants';
import { loadAgentByName, loadAgentsByCategory } from '../loader';
import { type ScoredAgent, selectAgents } from '../selection';
import type { AgentDefinition } from '../types';
import type {
  AgentRecommendation,
  ExecutionPhase,
  ExecutionPlan,
  ExecutionStrategy,
  OrchestrateOptions,
  TaskAnalysis,
} from './types';

/**
 * Agent Architect configuration
 * Used when no suitable agents found or when task explicitly requests agent creation
 */
const AGENT_ARCHITECT_CONFIG: AgentDefinition = {
  name: 'agent-architect',
  description:
    'Meta-agent that designs and generates production-ready AI agents with skills and tools. Use when you need to create a new specialized agent for any domain.',
  content: '',
  category: 'architecture',
  plugin: 'agent-architect',
  filePath: '~/.krolik/agents/plugins/agent-architect/agents/architect.md',
  componentType: 'agent',
  model: 'inherit',
};

/**
 * Confidence threshold below which we suggest Agent Architect
 */
const LOW_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Minimum agents required before suggesting architect
 */
const MIN_AGENTS_THRESHOLD = 1;

/**
 * Create Agent Architect recommendation
 */
function createAgentArchitectRecommendation(
  reason: string,
  priority: number = 1,
): AgentRecommendation {
  return {
    agent: AGENT_ARCHITECT_CONFIG,
    priority,
    reason,
    parallel: false, // Agent creation should be interactive
  };
}

/**
 * Determine if we should suggest Agent Architect
 */
function shouldSuggestAgentArchitect(
  analysis: TaskAnalysis,
  existingRecommendations: AgentRecommendation[],
): { suggest: boolean; reason: string } {
  // Case 1: Explicit agent creation request
  if (analysis.taskType === 'agent-creation') {
    return {
      suggest: true,
      reason: 'Task requires creating a new agent',
    };
  }

  // Case 2: No agents found
  if (existingRecommendations.length === 0) {
    return {
      suggest: true,
      reason: `No existing agents match task "${analysis.task.slice(0, 50)}...". Create a specialized agent?`,
    };
  }

  // Case 3: Low confidence in matches
  if (
    analysis.confidence < LOW_CONFIDENCE_THRESHOLD &&
    existingRecommendations.length < MIN_AGENTS_THRESHOLD
  ) {
    return {
      suggest: true,
      reason: `Low confidence (${Math.round(analysis.confidence * 100)}%) in available agents. Consider creating a specialized agent?`,
    };
  }

  return { suggest: false, reason: '' };
}

/**
 * Get agent recommendations for a task
 */
export function getAgentRecommendations(
  analysis: TaskAnalysis,
  agentsPath: string,
  options: OrchestrateOptions = {},
): AgentRecommendation[] {
  const recommendations: AgentRecommendation[] = [];
  const maxAgents = options.maxAgents ?? 5;

  // Check if task explicitly requests agent creation
  if (analysis.taskType === 'agent-creation') {
    const architectRec = createAgentArchitectRecommendation(
      'Task requires creating a new agent',
      1,
    );
    return [architectRec];
  }

  // Get categories to search
  let categoriesToSearch = analysis.categories;
  if (options.includeCategories) {
    categoriesToSearch = categoriesToSearch.filter((c) => options.includeCategories?.includes(c));
  }
  if (options.excludeCategories) {
    categoriesToSearch = categoriesToSearch.filter((c) => !options.excludeCategories?.includes(c));
  }

  // Load agents for each category
  let priority = 1;
  for (const category of categoriesToSearch) {
    const categoryInfo = AGENT_CATEGORIES[category];
    const agents = loadAgentsByCategory(agentsPath, category);

    // Prefer primary agents
    const primaryAgents = agents.filter((a) => categoryInfo.primaryAgents.includes(a.name));
    const agentsToAdd =
      primaryAgents.length > 0
        ? primaryAgents.slice(0, LIMITS.PRIMARY_AGENTS_TO_ADD)
        : agents.slice(0, LIMITS.FALLBACK_AGENTS);

    for (const agent of agentsToAdd) {
      if (recommendations.length >= maxAgents) break;

      recommendations.push({
        agent,
        priority: priority++,
        reason: `Matched category: ${category}`,
        parallel: options.preferParallel ?? categoriesToSearch.length > 1,
      });
    }
  }

  // Check if we should suggest Agent Architect
  const { suggest, reason } = shouldSuggestAgentArchitect(analysis, recommendations);
  if (suggest && recommendations.length < maxAgents) {
    // Add architect as last recommendation (can create better agent for task)
    const architectRec = createAgentArchitectRecommendation(reason, recommendations.length + 1);
    recommendations.push(architectRec);
  }

  return recommendations;
}

/**
 * Get agent recommendations using smart scoring
 *
 * Uses three-stage pipeline:
 * 1. Keyword pre-filtering
 * 2. Context boosting (project profile)
 * 3. History boosting (memory)
 *
 * Also suggests Agent Architect when:
 * - Task explicitly requests agent creation
 * - No suitable agents found
 * - Low confidence in matches
 */
export async function getSmartAgentRecommendations(
  analysis: TaskAnalysis,
  projectRoot: string,
  agentsPath: string,
  options: OrchestrateOptions = {},
): Promise<{ recommendations: AgentRecommendation[]; scoredAgents: ScoredAgent[] }> {
  const maxAgents = options.maxAgents ?? 5;

  // Check if task explicitly requests agent creation
  if (analysis.taskType === 'agent-creation') {
    const architectRec = createAgentArchitectRecommendation(
      'Task requires creating a new agent',
      1,
    );
    return { recommendations: [architectRec], scoredAgents: [] };
  }

  // Use smart selection
  const result = await selectAgents(analysis.task, projectRoot, agentsPath, {
    currentFeature: options.feature,
    maxAgents,
    minScore: 15, // Lower threshold to get more candidates
  });

  // Convert scored agents to recommendations
  // Load full agent definitions to get content for prompts
  const recommendations: AgentRecommendation[] = result.agents.map((scored, index) => {
    // Load full agent to get content (capabilities index doesn't store it)
    const fullAgent = loadAgentByName(agentsPath, scored.agent.name);
    const content = fullAgent?.content ?? '';

    return {
      agent: {
        name: scored.agent.name,
        description: scored.agent.description,
        content, // Full agent prompt content
        category: scored.agent.category,
        plugin: scored.agent.plugin,
        filePath: scored.agent.filePath,
        componentType: 'agent' as const,
        model: scored.agent.model,
      },
      priority: index + 1,
      reason: formatSmartReason(scored),
      parallel: options.preferParallel ?? true,
    };
  });

  // Check if we should suggest Agent Architect
  const { suggest, reason } = shouldSuggestAgentArchitect(analysis, recommendations);
  if (suggest && recommendations.length < maxAgents) {
    // Add architect as last recommendation
    const architectRec = createAgentArchitectRecommendation(reason, recommendations.length + 1);
    recommendations.push(architectRec);
  }

  return { recommendations, scoredAgents: result.agents };
}

/**
 * Format smart selection reason from score breakdown
 */
function formatSmartReason(scored: ScoredAgent): string {
  const parts: string[] = [];
  const { breakdown } = scored;

  if (breakdown.matchedKeywords.length > 0) {
    parts.push(`Keywords: ${breakdown.matchedKeywords.slice(0, 3).join(', ')}`);
  }

  // Show semantic similarity if used
  if (breakdown.semanticMatch > 0 && breakdown.semanticSimilarity) {
    const pct = Math.round(breakdown.semanticSimilarity * 100);
    parts.push(`Semantic: ${pct}%`);
  }

  if (breakdown.matchedTechStack.length > 0) {
    parts.push(`Tech: ${breakdown.matchedTechStack.join(', ')}`);
  }

  if (breakdown.historyBoost > 0) {
    parts.push('Has history');
  }

  if (parts.length === 0) {
    parts.push(`Score: ${scored.score}`);
  }

  return parts.join(' | ');
}

/**
 * Create execution plan from recommendations
 */
export function createExecutionPlan(
  recommendations: AgentRecommendation[],
  options: OrchestrateOptions = {},
): ExecutionPlan {
  if (recommendations.length === 0) {
    return {
      phases: [],
      totalAgents: 0,
      strategy: 'sequential',
    };
  }

  // Group by parallel capability
  const parallelAgents = recommendations.filter((r) => r.parallel);
  const sequentialAgents = recommendations.filter((r) => !r.parallel);

  const phases: ExecutionPhase[] = [];

  // If preferParallel and all can run in parallel
  if (options.preferParallel && sequentialAgents.length === 0) {
    phases.push({
      name: 'Parallel Analysis',
      agents: parallelAgents,
      parallel: true,
    });
    return {
      phases,
      totalAgents: recommendations.length,
      strategy: 'parallel',
    };
  }

  // Mixed strategy: parallel first, then sequential
  if (parallelAgents.length > 0) {
    phases.push({
      name: 'Phase 1: Independent Analysis',
      agents: parallelAgents,
      parallel: true,
    });
  }

  if (sequentialAgents.length > 0) {
    phases.push({
      name: 'Phase 2: Dependent Analysis',
      agents: sequentialAgents,
      parallel: false,
    });
  }

  const strategy: ExecutionStrategy =
    parallelAgents.length > 0 && sequentialAgents.length > 0
      ? 'mixed'
      : parallelAgents.length > 0
        ? 'parallel'
        : 'sequential';

  return {
    phases,
    totalAgents: recommendations.length,
    strategy,
  };
}
