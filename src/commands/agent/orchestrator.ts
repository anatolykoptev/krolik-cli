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

import { escapeXml } from '../../lib/@format';
import { AGENT_CATEGORIES } from './categories';
import { buildAgentContext, formatContextForPrompt } from './context';
import { findAgentsPath, loadAgentsByCategory } from './loader';
import type { AgentCategory, AgentContext, AgentDefinition } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Task analysis result from orchestrator
 */
export interface TaskAnalysis {
  /** Original task description */
  task: string;
  /** Detected task type */
  taskType: TaskType;
  /** Confidence level (0-1) */
  confidence: number;
  /** Detected categories */
  categories: AgentCategory[];
  /** Recommended agents */
  agents: AgentRecommendation[];
  /** Execution strategy */
  strategy: ExecutionStrategy;
  /** Keywords that triggered detection */
  keywords: string[];
}

/**
 * Task types the orchestrator can detect
 */
export type TaskType =
  | 'code-review'
  | 'security-audit'
  | 'performance-optimization'
  | 'architecture-design'
  | 'debugging'
  | 'documentation'
  | 'testing'
  | 'refactoring'
  | 'feature-implementation'
  | 'multi-domain'
  | 'unknown';

/**
 * Agent recommendation with priority
 */
export interface AgentRecommendation {
  agent: AgentDefinition;
  priority: number; // 1 = highest
  reason: string;
  parallel: boolean; // Can run in parallel with others
}

/**
 * Execution strategy for agents
 */
export type ExecutionStrategy = 'sequential' | 'parallel' | 'mixed';

/**
 * Orchestration options
 */
export interface OrchestrateOptions {
  /** Maximum agents to run */
  maxAgents?: number | undefined;
  /** Categories to include/exclude */
  includeCategories?: AgentCategory[] | undefined;
  excludeCategories?: AgentCategory[] | undefined;
  /** Prefer parallel execution */
  preferParallel?: boolean | undefined;
  /** Include project context */
  includeContext?: boolean | undefined;
  /** Target file for analysis */
  file?: string | undefined;
  /** Feature/domain to focus on */
  feature?: string | undefined;
  /** Dry run - don't execute, just plan */
  dryRun?: boolean | undefined;
  /** Output format */
  format?: 'text' | 'xml' | 'json' | undefined;
}

/**
 * Orchestration result
 */
export interface OrchestrationResult {
  analysis: TaskAnalysis;
  plan: ExecutionPlan;
  context?: AgentContext | undefined;
  durationMs: number;
}

/**
 * Execution plan for agents
 */
export interface ExecutionPlan {
  /** Phases of execution (each phase can have parallel agents) */
  phases: ExecutionPhase[];
  /** Total estimated agents */
  totalAgents: number;
  /** Execution strategy used */
  strategy: ExecutionStrategy;
}

/**
 * Execution phase (agents in same phase can run in parallel)
 */
export interface ExecutionPhase {
  name: string;
  agents: AgentRecommendation[];
  parallel: boolean;
}

// ============================================================================
// TASK KEYWORDS
// ============================================================================

/**
 * Keywords mapped to task types and categories
 */
const TASK_KEYWORDS: Record<TaskType, { keywords: string[]; categories: AgentCategory[] }> = {
  'code-review': {
    keywords: [
      'review',
      'check',
      'quality',
      'clean',
      'refactor',
      'improve',
      'analyze code',
      'code analysis',
      'проверь',
      'ревью',
      'проанализируй код',
    ],
    categories: ['quality'],
  },
  'security-audit': {
    keywords: [
      'security',
      'audit',
      'vulnerability',
      'secure',
      'injection',
      'xss',
      'csrf',
      'auth',
      'безопасность',
      'уязвимост',
      'аудит',
    ],
    categories: ['security'],
  },
  'performance-optimization': {
    keywords: [
      'performance',
      'optimize',
      'speed',
      'slow',
      'fast',
      'profil',
      'производительность',
      'оптимиз',
      'медленно',
      'быстр',
    ],
    categories: ['performance'],
  },
  'architecture-design': {
    keywords: [
      'architecture',
      'design',
      'structure',
      'pattern',
      'system',
      'diagram',
      'c4',
      'архитектур',
      'дизайн',
      'структур',
      'паттерн',
    ],
    categories: ['architecture'],
  },
  debugging: {
    keywords: [
      'debug',
      'error',
      'bug',
      'fix',
      'issue',
      'problem',
      'crash',
      'incident',
      'отлад',
      'ошибк',
      'баг',
      'проблем',
      'инцидент',
    ],
    categories: ['debugging'],
  },
  documentation: {
    keywords: ['document', 'doc', 'readme', 'api doc', 'comment', 'документ', 'описа', 'readme'],
    categories: ['docs'],
  },
  testing: {
    keywords: ['test', 'unit', 'tdd', 'coverage', 'spec', 'jest', 'vitest', 'тест', 'покрыти'],
    categories: ['testing'],
  },
  refactoring: {
    keywords: [
      'refactor',
      'clean up',
      'legacy',
      'modernize',
      'restructure',
      'рефакторинг',
      'очистить',
      'модернизир',
    ],
    categories: ['quality', 'architecture'],
  },
  'feature-implementation': {
    keywords: [
      'implement',
      'add feature',
      'create',
      'build',
      'develop',
      'реализ',
      'добавь',
      'создай',
      'разработ',
    ],
    categories: ['backend', 'frontend'],
  },
  'multi-domain': {
    keywords: [
      'full',
      'complete',
      'comprehensive',
      'all',
      'everything',
      'multi',
      'полн',
      'компл',
      'всё',
      'мультиагент',
    ],
    categories: ['quality', 'security', 'performance', 'architecture'],
  },
  unknown: {
    keywords: [],
    categories: [],
  },
};

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
- security → Security issues, vulnerabilities, auth
- performance → Speed, optimization, profiling
- architecture → Design, structure, patterns
- quality → Code review, refactoring
- debugging → Errors, bugs, incidents
- docs → Documentation
- frontend → UI, React, CSS
- backend → API, server, microservices
- database → SQL, Prisma, schema
- devops → CI/CD, Docker, K8s
- testing → Tests, TDD

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
// ORCHESTRATION LOGIC
// ============================================================================

/**
 * Detected task type with score
 */
interface DetectedType {
  type: TaskType;
  score: number;
  keywords: string[];
}

/**
 * Score task against all keyword configurations
 */
function scoreTaskTypes(normalizedTask: string): DetectedType[] {
  const detectedTypes: DetectedType[] = [];

  for (const [taskType, config] of Object.entries(TASK_KEYWORDS)) {
    const matchedKeywords: string[] = [];
    for (const keyword of config.keywords) {
      if (normalizedTask.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      }
    }
    if (matchedKeywords.length > 0) {
      detectedTypes.push({
        type: taskType as TaskType,
        score: matchedKeywords.length,
        keywords: matchedKeywords,
      });
    }
  }

  return detectedTypes.sort((a, b) => b.score - a.score);
}

/**
 * Collect unique categories from detected types
 */
function collectCategories(detectedTypes: DetectedType[]): AgentCategory[] {
  const categories: AgentCategory[] = [];
  for (const detected of detectedTypes) {
    const config = TASK_KEYWORDS[detected.type];
    for (const cat of config.categories) {
      if (!categories.includes(cat)) {
        categories.push(cat);
      }
    }
  }
  return categories;
}

/**
 * Determine primary task type from detected types
 */
function determinePrimaryType(detectedTypes: DetectedType[]): {
  taskType: TaskType;
  confidence: number;
  keywords: string[];
} {
  if (detectedTypes.length === 0) {
    return { taskType: 'unknown', confidence: 0, keywords: [] };
  }

  const primary = detectedTypes[0];
  if (!primary) {
    return { taskType: 'unknown', confidence: 0, keywords: [] };
  }

  const second = detectedTypes[1];
  const isMultiDomain = detectedTypes.length >= 2 && second && second.score >= 2;

  if (isMultiDomain) {
    return {
      taskType: 'multi-domain',
      confidence: 0.8,
      keywords: detectedTypes.flatMap((d) => d.keywords),
    };
  }

  return {
    taskType: primary.type,
    confidence: Math.min(primary.score / 3, 1),
    keywords: primary.keywords,
  };
}

/**
 * Analyze a task and determine which agents to invoke
 */
export function analyzeTask(task: string): TaskAnalysis {
  const normalizedTask = task.toLowerCase();
  const detectedTypes = scoreTaskTypes(normalizedTask);
  const { taskType, confidence, keywords } = determinePrimaryType(detectedTypes);
  const categories = collectCategories(detectedTypes);

  return {
    task,
    taskType,
    confidence,
    categories,
    agents: [],
    strategy: categories.length > 2 ? 'mixed' : 'sequential',
    keywords,
  };
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
    const agentsToAdd = primaryAgents.length > 0 ? primaryAgents.slice(0, 2) : agents.slice(0, 1);

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

// ============================================================================
// OUTPUT FORMATTERS
// ============================================================================

/**
 * Format orchestration result as XML for Claude
 */
export function formatOrchestrationXML(result: OrchestrationResult): string {
  const { analysis, plan, context, durationMs } = result;

  let xml = `<agent-orchestration>
  <task-analysis>
    <original-task>${escapeXml(analysis.task)}</original-task>
    <detected-type>${analysis.taskType}</detected-type>
    <confidence>${(analysis.confidence * 100).toFixed(0)}%</confidence>
    <categories>${analysis.categories.join(', ')}</categories>
    <keywords>${analysis.keywords.join(', ')}</keywords>
  </task-analysis>

  <execution-plan strategy="${plan.strategy}" total-agents="${plan.totalAgents}">
`;

  for (const phase of plan.phases) {
    xml += `    <phase name="${escapeXml(phase.name)}" parallel="${phase.parallel}">
`;
    for (const rec of phase.agents) {
      xml += `      <agent name="${escapeXml(rec.agent.name)}" priority="${rec.priority}">
        <description>${escapeXml(rec.agent.description)}</description>
        <category>${rec.agent.category}</category>
        <model>${rec.agent.model ?? 'inherit'}</model>
        <reason>${escapeXml(rec.reason)}</reason>
      </agent>
`;
    }
    xml += `    </phase>
`;
  }

  xml += `  </execution-plan>

  <instructions>
    Execute agents according to the plan above:
    1. For parallel phases, use Task tool with multiple agents simultaneously
    2. For sequential phases, run agents one by one
    3. Aggregate results and present unified findings
    4. Prioritize critical issues across all agent outputs
  </instructions>

  <duration-ms>${durationMs}</duration-ms>
</agent-orchestration>`;

  // Add context if available
  if (context) {
    xml += `\n\n${formatContextForPrompt(context)}`;
  }

  return xml;
}

/**
 * Format orchestration result as text
 */
export function formatOrchestrationText(result: OrchestrationResult): string {
  const { analysis, plan, durationMs } = result;

  let text = `=== Agent Orchestration ===

Task: ${analysis.task}
Type: ${analysis.taskType} (${(analysis.confidence * 100).toFixed(0)}% confidence)
Categories: ${analysis.categories.join(', ')}
Strategy: ${plan.strategy}

Execution Plan (${plan.totalAgents} agents):
`;

  for (const phase of plan.phases) {
    text += `\n${phase.name} ${phase.parallel ? '[PARALLEL]' : '[SEQUENTIAL]'}:\n`;
    for (const rec of phase.agents) {
      text += `  ${rec.priority}. ${rec.agent.name} (${rec.agent.category})\n`;
      text += `     ${rec.agent.description.slice(0, 60)}...\n`;
    }
  }

  text += `\nAnalysis time: ${durationMs}ms`;

  return text;
}

/**
 * Format orchestration result as JSON
 */
export function formatOrchestrationJSON(result: OrchestrationResult): string {
  return JSON.stringify(
    {
      analysis: {
        task: result.analysis.task,
        taskType: result.analysis.taskType,
        confidence: result.analysis.confidence,
        categories: result.analysis.categories,
        keywords: result.analysis.keywords,
      },
      plan: {
        strategy: result.plan.strategy,
        totalAgents: result.plan.totalAgents,
        phases: result.plan.phases.map((phase) => ({
          name: phase.name,
          parallel: phase.parallel,
          agents: phase.agents.map((rec) => ({
            name: rec.agent.name,
            category: rec.agent.category,
            priority: rec.priority,
            reason: rec.reason,
          })),
        })),
      },
      durationMs: result.durationMs,
    },
    null,
    2,
  );
}
