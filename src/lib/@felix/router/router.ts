/**
 * @module lib/@felix/router/router
 * @description Main model router that combines rules, history, and cascade
 */

import { createCascadeDecision } from './cascade';
import { estimateTotalCost, formatCostEstimate } from './cost-estimator';
import { analyzeHistory, createTaskSignature, getBestModelFromHistory } from './history';
import { calculateTaskScore, compareTiers, DEFAULT_MODELS } from './rules';
import type {
  CostEstimate,
  ExecutionMode,
  ExecutionPlan,
  ModelPreference,
  RoutingDecision,
  TaskAttributes,
} from './types';

// ============================================================================
// MODEL ROUTER
// ============================================================================

export interface RouteTaskOptions {
  task: TaskAttributes;
  preference?: ModelPreference | undefined;
  projectPath: string;
}

/**
 * Route a task to the best model
 *
 * Priority:
 * 1. Explicit model preference
 * 2. History-based recommendation (if enough data)
 * 3. Rule-based scoring
 */
export function routeTask(options: RouteTaskOptions): RoutingDecision {
  const { task, preference, projectPath } = options;

  // 1. Check for explicit model preference
  if (preference?.model) {
    const model = preference.model;

    return createCascadeDecision(
      task.id,
      model,
      'preference',
      100, // Max score for explicit preference
      preference.noCascade,
      preference.forceMode,
    );
  }

  // 2. Calculate rule-based score
  const scoring = calculateTaskScore(task);
  let tier = scoring.tier;
  let suggestedModel = scoring.suggestedModel;
  let source: RoutingDecision['source'] = 'rule';

  // 3. Apply minimum tier preference
  if (preference?.minTier) {
    if (compareTiers(tier, preference.minTier) < 0) {
      tier = preference.minTier;
      suggestedModel = DEFAULT_MODELS[tier];
    }
  }

  // 4. Check history for adjustments
  const signature = createTaskSignature(task);
  const historyAdjustment = analyzeHistory(task, tier, projectPath);

  if (historyAdjustment && historyAdjustment.confidence > 0.5) {
    tier = historyAdjustment.adjustedTier;
    suggestedModel = DEFAULT_MODELS[tier];
    source = 'history';
  }

  // 5. Try to find best model from history for this signature
  const historyModel = getBestModelFromHistory(signature.hash, tier, projectPath);
  if (historyModel) {
    suggestedModel = historyModel;
    source = 'history';
  }

  return createCascadeDecision(
    task.id,
    suggestedModel,
    source,
    scoring.score,
    preference?.noCascade,
    preference?.forceMode,
  );
}

/**
 * Route multiple tasks and return routing decisions
 */
export function routeTasks(
  tasks: TaskAttributes[],
  projectPath: string,
  defaultPreference?: ModelPreference,
): RoutingDecision[] {
  return tasks.map((task) =>
    routeTask({
      task,
      preference: defaultPreference,
      projectPath,
    }),
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format routing decision for display
 */
export function formatRoutingDecision(decision: RoutingDecision): string {
  const canEscalate = decision.canEscalate ? 'yes' : 'no';
  const path = decision.escalationPath.join(' → ') || 'none';
  const exec = decision.execution;

  return (
    `Task: ${decision.taskId}\n` +
    `  Model: ${decision.selectedModel} (${decision.tier})\n` +
    `  Source: ${decision.source}\n` +
    `  Score: ${decision.score}\n` +
    `  Execution: ${exec.mode} (${exec.reason})\n` +
    `  Agents: ${exec.suggestedAgentCount}, parallel: ${exec.parallelizable}\n` +
    `  Can escalate: ${canEscalate}\n` +
    `  Escalation path: ${path}`
  );
}

/**
 * Format routing decisions as XML
 */
export function formatRoutingDecisionsXml(decisions: RoutingDecision[]): string {
  const lines: string[] = [];

  lines.push('<routing-plan>');

  for (const decision of decisions) {
    const exec = decision.execution;
    lines.push(`  <task id="${decision.taskId}">`);
    lines.push(`    <model>${decision.selectedModel}</model>`);
    lines.push(`    <tier>${decision.tier}</tier>`);
    lines.push(`    <source>${decision.source}</source>`);
    lines.push(`    <score>${decision.score}</score>`);
    lines.push(
      `    <execution mode="${exec.mode}" agents="${exec.suggestedAgentCount}" parallel="${exec.parallelizable}">`,
    );
    lines.push(`      <reason>${exec.reason}</reason>`);
    lines.push('    </execution>');
    lines.push(`    <can-escalate>${decision.canEscalate}</can-escalate>`);
    if (decision.escalationPath.length > 0) {
      lines.push(`    <escalation-path>${decision.escalationPath.join(' → ')}</escalation-path>`);
    }
    lines.push('  </task>');
  }

  lines.push('</routing-plan>');

  return lines.join('\n');
}

/**
 * Get summary statistics for routing decisions
 */
export function getRoutingPlanSummary(decisions: RoutingDecision[]): {
  totalTasks: number;
  byTier: Record<string, number>;
  byModel: Record<string, number>;
  bySource: Record<string, number>;
  byExecutionMode: Record<string, number>;
  totalAgents: number;
  parallelizable: number;
  escalatable: number;
} {
  const byTier: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const byExecutionMode: Record<string, number> = {};
  let escalatable = 0;
  let totalAgents = 0;
  let parallelizable = 0;

  for (const decision of decisions) {
    byTier[decision.tier] = (byTier[decision.tier] ?? 0) + 1;
    byModel[decision.selectedModel] = (byModel[decision.selectedModel] ?? 0) + 1;
    bySource[decision.source] = (bySource[decision.source] ?? 0) + 1;
    byExecutionMode[decision.execution.mode] = (byExecutionMode[decision.execution.mode] ?? 0) + 1;
    totalAgents += decision.execution.suggestedAgentCount;
    if (decision.execution.parallelizable) parallelizable++;
    if (decision.canEscalate) escalatable++;
  }

  return {
    totalTasks: decisions.length,
    byTier,
    byModel,
    bySource,
    byExecutionMode,
    totalAgents,
    parallelizable,
    escalatable,
  };
}

// ============================================================================
// PRD-LEVEL ROUTING
// ============================================================================

/**
 * PRD-level routing plan containing decisions for all tasks
 * and overall execution strategy
 */
export interface PRDRoutingPlan {
  /** Per-task routing decisions */
  taskDecisions: RoutingDecision[];
  /** Overall execution mode for the PRD */
  overallMode: ExecutionMode;
  /** Overall execution plan with reasoning */
  overallPlan: ExecutionPlan;
  /** Summary statistics */
  summary: ReturnType<typeof getRoutingPlanSummary>;
  /** Cost estimate for the PRD */
  costEstimate: CostEstimate;
}

export interface RoutePRDOptions {
  tasks: TaskAttributes[];
  projectPath: string;
  preference?: ModelPreference;
}

/**
 * Route an entire PRD and determine overall execution strategy
 *
 * Logic:
 * 1. Route each task individually
 * 2. Aggregate decisions to determine overall mode:
 *    - If any task is 'multi' → use multi-agent for whole PRD
 *    - If majority is parallelizable → prefer multi-agent
 *    - Otherwise → single-agent sequential
 */
export function routePRD(options: RoutePRDOptions): PRDRoutingPlan {
  const { tasks, projectPath, preference } = options;

  // Route each task
  const taskDecisions = tasks.map((task) =>
    routeTask({
      task,
      preference,
      projectPath,
    }),
  );

  // Get summary statistics
  const summary = getRoutingPlanSummary(taskDecisions);

  // Determine overall execution mode
  const overallMode = determineOverallMode(taskDecisions, summary);

  // Create overall execution plan
  const overallPlan = createOverallPlan(overallMode, summary, tasks.length);

  // Calculate cost estimate
  const costEstimate = estimateTotalCost(tasks, projectPath);

  return {
    taskDecisions,
    overallMode,
    overallPlan,
    summary,
    costEstimate,
  };
}

/**
 * Format cost estimate for logging (re-export from cost-estimator)
 */
export { formatCostEstimate };

/**
 * Determine overall execution mode from task decisions
 */
function determineOverallMode(
  decisions: RoutingDecision[],
  summary: ReturnType<typeof getRoutingPlanSummary>,
): ExecutionMode {
  // If forced mode was set (check first decision)
  const firstDecision = decisions[0];
  if (firstDecision?.execution.reason.startsWith('forced by preference')) {
    return firstDecision.execution.mode;
  }

  // If any task requires multi-agent, use multi for the whole PRD
  const multiCount = summary.byExecutionMode['multi'] ?? 0;
  if (multiCount > 0) {
    return 'multi';
  }

  // If more than half of tasks are parallelizable, prefer multi-agent
  const parallelRatio = summary.parallelizable / summary.totalTasks;
  if (parallelRatio > 0.5 && summary.totalTasks >= 3) {
    return 'multi';
  }

  // If we have premium tier tasks (complex/epic), consider multi-agent
  const premiumCount = summary.byTier['premium'] ?? 0;
  if (premiumCount >= 2 || (premiumCount >= 1 && summary.totalTasks >= 3)) {
    return 'multi';
  }

  // Default to single-agent sequential
  return 'single';
}

/**
 * Create overall execution plan with reasoning
 */
function createOverallPlan(
  mode: ExecutionMode,
  summary: ReturnType<typeof getRoutingPlanSummary>,
  taskCount: number,
): ExecutionPlan {
  if (mode === 'multi') {
    const multiCount = summary.byExecutionMode['multi'] ?? 0;
    const premiumCount = summary.byTier['premium'] ?? 0;
    const parallelRatio = summary.parallelizable / taskCount;

    let reason: string;
    if (multiCount > 0) {
      reason = `${multiCount} task(s) require multi-agent execution`;
    } else if (premiumCount >= 2) {
      reason = `${premiumCount} premium tier tasks benefit from parallel workers`;
    } else if (parallelRatio > 0.5) {
      reason = `${Math.round(parallelRatio * 100)}% of tasks are parallelizable`;
    } else {
      reason = 'complex PRD benefits from multi-agent coordination';
    }

    return {
      mode: 'multi',
      parallelizable: true,
      suggestedAgentCount: Math.min(5, Math.ceil(taskCount / 2)),
      reason,
    };
  }

  // Single-agent mode
  return {
    mode: 'single',
    parallelizable: false,
    suggestedAgentCount: 1,
    reason: `simple PRD with ${taskCount} task(s) - single agent efficient`,
  };
}
