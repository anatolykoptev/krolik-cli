/**
 * @module commands/agent/orchestrator/execution-plan
 * @description Execution plan creation for agent orchestration
 */

import { AGENT_CATEGORIES } from '../categories';
import { LIMITS } from '../constants';
import { loadAgentsByCategory } from '../loader';
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
