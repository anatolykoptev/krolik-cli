/**
 * @module commands/agent/orchestrator/execution-plan
 * @description Execution plan creation for agent orchestration
 *
 * Supports two selection modes:
 * - Legacy: Hardcoded primaryAgents lists (default)
 * - Smart: Context-aware scoring with history (--smart-selection flag)
 */

import { AGENT_CATEGORIES } from '../categories';
import { LIMITS } from '../constants';
import { loadAgentsByCategory } from '../loader';
import { type ScoredAgent, selectAgents } from '../selection';
import type {
  AgentRecommendation,
  ExecutionPhase,
  ExecutionPlan,
  ExecutionStrategy,
  OrchestrateOptions,
  TaskAnalysis,
} from './types';

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

  return recommendations;
}

/**
 * Get agent recommendations using smart scoring
 *
 * Uses three-stage pipeline:
 * 1. Keyword pre-filtering
 * 2. Context boosting (project profile)
 * 3. History boosting (memory)
 */
export async function getSmartAgentRecommendations(
  analysis: TaskAnalysis,
  projectRoot: string,
  agentsPath: string,
  options: OrchestrateOptions = {},
): Promise<{ recommendations: AgentRecommendation[]; scoredAgents: ScoredAgent[] }> {
  const maxAgents = options.maxAgents ?? 5;

  // Use smart selection
  const result = await selectAgents(analysis.task, projectRoot, agentsPath, {
    currentFeature: options.feature,
    maxAgents,
    minScore: 15, // Lower threshold to get more candidates
  });

  // Convert scored agents to recommendations
  const recommendations: AgentRecommendation[] = result.agents.map((scored, index) => ({
    agent: {
      name: scored.agent.name,
      description: scored.agent.description,
      content: '', // Not needed for recommendations
      category: scored.agent.category,
      plugin: scored.agent.plugin,
      filePath: scored.agent.filePath,
      componentType: 'agent' as const,
      model: scored.agent.model,
    },
    priority: index + 1,
    reason: formatSmartReason(scored),
    parallel: options.preferParallel ?? true,
  }));

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
