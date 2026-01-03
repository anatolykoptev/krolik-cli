/**
 * @module commands/agent/orchestrator
 * @description Agent Orchestrator - intelligent task router and multi-agent coordinator
 *
 * The orchestrator analyzes user tasks and determines which agents to invoke.
 * It can run agents sequentially or in parallel, aggregate results, and provide
 * a unified execution plan.
 *
 * Usage:
 * - Via CLI: krolik agent --orchestrate "analyze security and performance"
 * - Via MCP: krolik_agent with orchestrate=true
 * - Direct: import { orchestrate } from './orchestrator'
 */

import { buildAgentContext } from './context';
import { findAgentsPath } from './loader';
import type { AgentContext, AgentDefinition } from './types';

export {
  createExecutionPlan,
  getAgentRecommendations,
} from './orchestrator/execution-plan';
export {
  formatOrchestrationJSON,
  formatOrchestrationText,
  formatOrchestrationXML,
} from './orchestrator/formatters';
export {
  analyzeTask,
  collectCategories,
  determinePrimaryType,
  scoreTaskTypes,
  TASK_KEYWORDS,
} from './orchestrator/task-analysis';
// Re-export everything from submodules for backward compatibility
export type {
  AgentRecommendation,
  DetectedType,
  ExecutionPhase,
  ExecutionPlan,
  ExecutionStrategy,
  OrchestrateOptions,
  OrchestrationResult,
  TaskAnalysis,
  TaskKeywordConfig,
  TaskType,
} from './orchestrator/types';

import { createExecutionPlan, getAgentRecommendations } from './orchestrator/execution-plan';
// Import for internal use
import { analyzeTask } from './orchestrator/task-analysis';
import type { OrchestrateOptions, OrchestrationResult } from './orchestrator/types';

// ============================================================================
// BUILT-IN AGENTS
// ============================================================================

/**
 * Built-in orchestrator agent definition
 */
export const ORCHESTRATOR_AGENT: AgentDefinition = {
  name: 'agent-orchestrator',
  description:
    'Intelligent task router that analyzes requests and coordinates multiple specialized agents. Use when the task requires expertise from multiple domains.',
  model: 'sonnet',
  content: `You are an AI Agent Orchestrator. Your role is to:

1. ANALYZE the user's task and determine what expertise is needed
2. IDENTIFY which specialized agents should be invoked
3. PLAN the execution order (sequential vs parallel)
4. COORDINATE the results from multiple agents
5. SYNTHESIZE a unified response

When orchestrating:
- Break complex tasks into subtasks for specific agents
- Run independent analyses in parallel
- Chain dependent analyses sequentially
- Aggregate findings without duplication
- Prioritize critical issues

Available agent categories:
- security: Security auditing, vulnerability detection
- performance: Performance optimization, profiling
- architecture: System design, patterns, C4 diagrams
- quality: Code review, refactoring, best practices
- debugging: Error analysis, incident response
- docs: Documentation generation
- frontend: UI development, React patterns
- backend: API development, microservices
- database: Schema design, optimization
- devops: CI/CD, infrastructure
- testing: Unit tests, TDD workflows

Output your orchestration plan in XML format for Claude to execute.`,
  category: 'other',
  plugin: 'krolik-builtin',
  filePath: 'builtin:orchestrator',
  componentType: 'agent',
};

/**
 * Built-in task router agent
 */
export const TASK_ROUTER_AGENT: AgentDefinition = {
  name: 'task-router',
  description:
    'Quick task classifier that routes requests to the appropriate agent category. Faster than full orchestration.',
  model: 'haiku',
  content: `You are a Task Router. Quickly classify the user's request and route to the appropriate agent category.

Categories:
- security -> Security issues, vulnerabilities, auth
- performance -> Speed, optimization, profiling
- architecture -> Design, structure, patterns
- quality -> Code review, refactoring
- debugging -> Errors, bugs, incidents
- docs -> Documentation
- frontend -> UI, React, CSS
- backend -> API, server, microservices
- database -> SQL, Prisma, schema
- devops -> CI/CD, Docker, K8s
- testing -> Tests, TDD

Respond with just the category name(s).`,
  category: 'other',
  plugin: 'krolik-builtin',
  filePath: 'builtin:task-router',
  componentType: 'agent',
};

/**
 * All built-in agents
 */
export const BUILTIN_AGENTS: AgentDefinition[] = [ORCHESTRATOR_AGENT, TASK_ROUTER_AGENT];

// ============================================================================
// MAIN ORCHESTRATION FUNCTION
// ============================================================================

/**
 * Main orchestration function
 */
export async function orchestrate(
  task: string,
  projectRoot: string,
  options: OrchestrateOptions = {},
): Promise<OrchestrationResult> {
  const startTime = Date.now();

  // Find agents
  const agentsPath = findAgentsPath(projectRoot);
  if (!agentsPath) {
    throw new Error('Agents not found. Run: krolik agent --install');
  }

  // Analyze task
  const analysis = analyzeTask(task);

  // Get recommendations
  analysis.agents = getAgentRecommendations(analysis, agentsPath, options);

  // Create execution plan
  const plan = createExecutionPlan(analysis.agents, options);

  // Build context if needed
  let context: AgentContext | undefined;
  if (options.includeContext !== false) {
    context = await buildAgentContext(projectRoot, {
      file: options.file,
      feature: options.feature,
      includeSchema: true,
      includeRoutes: true,
      includeGit: true,
    });
  }

  return {
    analysis,
    plan,
    context,
    durationMs: Date.now() - startTime,
  };
}
