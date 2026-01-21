/**
 * @module commands/agent/orchestrator
 * @description Agent Orchestrator - intelligent task router and multi-agent coordinator
 *
 * The orchestrator analyzes user tasks and determines which agents to invoke.
 * It can run agents sequentially or in parallel, aggregate results, and provide
 * a unified execution plan.
 *
 * Features:
 * - Smart agent selection with context-aware scoring
 * - Ad-hoc agent generation when no suitable agents found
 * - Consilium mode for multi-agent analysis
 *
 * Usage:
 * - Via CLI: krolik agent --orchestrate "analyze security and performance"
 * - Via CLI: krolik agent --consilium "analyze this as a SaaS product"
 * - Via MCP: krolik_agent with orchestrate=true or consilium=true
 * - Direct: import { orchestrate, consilium } from './orchestrator'
 */

import {
  type AdHocGenerationRequest,
  type AdHocGenerationResponse,
  formatConsiliumExecution,
  formatConsiliumJSON,
  formatConsiliumText,
  prepareAdHocGeneration,
} from './adhoc';
import { buildAgentContext } from './context';
import { findAgentsPath } from './loader';
import type { AgentContext, AgentDefinition } from './types';

export {
  createExecutionPlan,
  getAgentRecommendations,
  getSmartAgentRecommendations,
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
  ConsiliumReason,
  ConsiliumRecommendation,
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

import {
  createExecutionPlan,
  getAgentRecommendations,
  getSmartAgentRecommendations,
} from './orchestrator/execution-plan';
// Import for internal use
import { analyzeTask } from './orchestrator/task-analysis';
import type {
  ConsiliumRecommendation,
  OrchestrateOptions,
  OrchestrationResult,
  TaskAnalysis,
} from './orchestrator/types';

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
 *
 * Uses smart agent selection by default (context-aware scoring).
 * Pass `legacy: true` in options to use old keyword-based selection.
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

  // Get recommendations - smart by default, legacy if specified
  if (options.legacy) {
    // Legacy: keyword-based category matching
    analysis.agents = getAgentRecommendations(analysis, agentsPath, options);
  } else {
    // Smart: context-aware scoring with history (default)
    const { recommendations } = await getSmartAgentRecommendations(
      analysis,
      projectRoot,
      agentsPath,
      options,
    );
    analysis.agents = recommendations;
  }

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

  // Determine if Agent Architect should be recommended
  const consilium = determineConsiliumRecommendation(analysis, plan);

  return {
    analysis,
    plan,
    ...(context && { context }),
    consilium,
    ...(options.includePrompts && { includePrompts: options.includePrompts }),
    durationMs: Date.now() - startTime,
  };
}

/**
 * Determine if Agent Architect should be recommended
 */
function determineConsiliumRecommendation(
  analysis: TaskAnalysis,
  plan: { totalAgents: number },
): ConsiliumRecommendation {
  // Extract focus areas from task keywords and categories
  const suggestedFocusAreas = [...analysis.categories, ...analysis.keywords.slice(0, 3)].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );

  // No agents found at all
  if (plan.totalAgents === 0) {
    return {
      recommended: true,
      reason: 'no_agents_found',
      suggestedFocusAreas,
    };
  }

  // Low confidence suggests novel/complex domain
  if (analysis.confidence < 0.3) {
    return {
      recommended: true,
      reason: 'low_confidence',
      suggestedFocusAreas,
    };
  }

  // Multi-domain with many categories but few matching agents
  if (analysis.categories.length >= 3 && plan.totalAgents < 2) {
    return {
      recommended: true,
      reason: 'multi_domain_complex',
      suggestedFocusAreas,
    };
  }

  // Agents found, consilium not needed
  return {
    recommended: false,
    reason: 'not_needed',
    suggestedFocusAreas: [],
  };
}

// ============================================================================
// CONSILIUM (AD-HOC AGENT GENERATION)
// ============================================================================

/**
 * Options for consilium mode
 */
export interface ConsiliumOptions {
  /** Task to analyze */
  task: string;
  /** Additional context */
  context?: string;
  /** Specific focus areas */
  focusAreas?: string[];
  /** Maximum agents to generate */
  maxAgents?: number;
  /** Prefer parallel execution */
  preferParallel?: boolean;
  /** Output format */
  format?: 'xml' | 'text' | 'json';
  /** Include project context */
  includeProjectContext?: boolean;
  /** Dry run - only show plan */
  dryRun?: boolean;
  /** Target file for analysis */
  file?: string;
  /** Feature/domain focus */
  feature?: string;
  /** Include Prisma schema (default: true) */
  includeSchema?: boolean;
  /** Include tRPC routes (default: true) */
  includeRoutes?: boolean;
  /** Include git info (default: true) */
  includeGit?: boolean;
}

/**
 * Result of consilium preparation
 */
export interface ConsiliumPrepareResult {
  /** Prompt for LLM to generate agents */
  generationPrompt: string;
  /** Project context (if requested) */
  projectContext?: AgentContext;
  /** Function to parse LLM response */
  parseResponse: (response: string, durationMs: number) => AdHocGenerationResponse;
  /** Function to format for execution */
  formatExecution: (response: AdHocGenerationResponse) => string;
}

/**
 * Confidence threshold below which consilium is recommended
 */
const CONSILIUM_CONFIDENCE_THRESHOLD = 0.3;

/**
 * Minimum agents threshold for consilium recommendation
 */
const CONSILIUM_MIN_AGENTS = 1;

/**
 * Check if consilium mode should be recommended
 *
 * Returns true when:
 * - No suitable agents found
 * - Low confidence in existing agents
 * - Task is complex (multi-domain)
 */
export function shouldRecommendConsilium(result: OrchestrationResult): boolean {
  const { analysis, plan } = result;

  // No agents found
  if (plan.totalAgents === 0) {
    return true;
  }

  // Low confidence and few agents
  if (
    analysis.confidence < CONSILIUM_CONFIDENCE_THRESHOLD &&
    plan.totalAgents < CONSILIUM_MIN_AGENTS
  ) {
    return true;
  }

  // Only agent-architect recommended (circular case)
  const agentNames = plan.phases.flatMap((p) => p.agents.map((a) => a.agent.name));
  if (agentNames.length === 1 && agentNames[0] === 'agent-architect') {
    return true;
  }

  return false;
}

/**
 * Prepare consilium mode - generates prompt for Agent Architect
 *
 * This function does NOT call the LLM directly. Instead:
 * 1. Builds the generation prompt
 * 2. Returns it along with parse/format functions
 * 3. The caller (CLI or MCP) handles the LLM interaction
 *
 * Usage:
 * ```typescript
 * const prep = await prepareConsilium(projectRoot, options);
 * // Send prep.generationPrompt to LLM...
 * const response = await llm.complete(prep.generationPrompt);
 * const agents = prep.parseResponse(response, durationMs);
 * const output = prep.formatExecution(agents);
 * ```
 */
export async function prepareConsilium(
  projectRoot: string,
  options: ConsiliumOptions,
): Promise<ConsiliumPrepareResult> {
  // Build project context if requested
  let projectContext: AgentContext | undefined;
  if (options.includeProjectContext !== false) {
    projectContext = await buildAgentContext(projectRoot, {
      file: options.file,
      feature: options.feature,
      includeSchema: options.includeSchema !== false,
      includeRoutes: options.includeRoutes !== false,
      includeGit: options.includeGit !== false,
    });
  }

  // Build context string for generation prompt
  let contextString = '';
  if (projectContext) {
    const parts: string[] = [];
    if (projectContext.schema) {
      parts.push(`Database Schema:\n${projectContext.schema.slice(0, 500)}`);
    }
    if (projectContext.routes) {
      parts.push(`API Routes:\n${projectContext.routes.slice(0, 500)}`);
    }
    if (projectContext.gitStatus) {
      parts.push(`Git Status:\n${projectContext.gitStatus}`);
    }
    if (projectContext.feature) {
      parts.push(`Feature: ${projectContext.feature}`);
    }
    contextString = parts.join('\n\n');
  }

  // Prepare ad-hoc generation
  const contextValue = contextString || options.context;
  const request: AdHocGenerationRequest = {
    task: options.task,
    ...(contextValue && { context: contextValue }),
    ...(options.focusAreas && { focusAreas: options.focusAreas }),
    maxAgents: options.maxAgents ?? 5,
    preferParallel: options.preferParallel ?? true,
    projectRoot,
  };

  const { prompt, parseResponse } = prepareAdHocGeneration(request);

  // Format function based on output format
  const formatExecution = (response: AdHocGenerationResponse): string => {
    const execOptions = {
      task: options.task,
      ...(projectContext && { context: projectContext }),
      ...(options.format && { format: options.format }),
      verbose: false,
      ...(options.dryRun && { dryRun: options.dryRun }),
    };

    switch (options.format) {
      case 'text':
        return formatConsiliumText(response, execOptions);
      case 'json':
        return formatConsiliumJSON(response, execOptions);
      default:
        return formatConsiliumExecution(response, execOptions);
    }
  };

  return {
    generationPrompt: prompt,
    ...(projectContext && { projectContext }),
    parseResponse,
    formatExecution,
  };
}

/**
 * Format consilium recommendation for orchestration output
 */
export function formatConsiliumRecommendation(
  result: OrchestrationResult,
  format: 'xml' | 'text' | 'json' = 'xml',
): string {
  const { analysis } = result;

  if (format === 'text') {
    return `
⚠️  Low confidence in available agents (${(analysis.confidence * 100).toFixed(0)}%)

Consider using consilium mode for dynamic agent generation:
  krolik agent --consilium "${analysis.task}"

This will:
1. Analyze your task with Agent Architect
2. Generate specialized agents on-the-fly
3. Execute them in parallel/sequential phases
4. Synthesize results into unified output
`;
  }

  if (format === 'json') {
    return JSON.stringify(
      {
        type: 'consilium-recommendation',
        reason: 'low_confidence',
        confidence: analysis.confidence,
        suggestedCommand: `krolik agent --consilium "${analysis.task}"`,
      },
      null,
      2,
    );
  }

  // XML format
  return `<consilium-recommendation>
  <reason>Low confidence (${(analysis.confidence * 100).toFixed(0)}%) in available agents</reason>
  <suggestion>Use consilium mode for dynamic agent generation</suggestion>
  <command>krolik agent --consilium "${analysis.task}"</command>
  <benefits>
    <benefit>Agent Architect designs specialized agents for your task</benefit>
    <benefit>Multiple expert perspectives analyze your problem</benefit>
    <benefit>Results synthesized into actionable recommendations</benefit>
    <benefit>High-performing agents can be saved for future use</benefit>
  </benefits>
</consilium-recommendation>`;
}

// ============================================================================
// RE-EXPORTS FOR CONVENIENCE
// ============================================================================

export type {
  AdHocAgent,
  AdHocAgentArchetype,
  AdHocAgentResult,
  AdHocConsiliumResult,
  AdHocGenerationRequest,
  AdHocGenerationResponse,
  SaveAdHocAgentOptions,
  SaveAdHocAgentResult,
} from './adhoc';
// Re-export ad-hoc module
export {
  formatConsiliumExecution,
  formatConsiliumJSON,
  formatConsiliumText,
  prepareAdHocGeneration,
  SAVE_QUALITY_THRESHOLD,
  saveAdHocAgent,
  shouldRecommendSave,
  suggestCategory,
  suggestPluginName,
} from './adhoc';
