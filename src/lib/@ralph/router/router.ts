/**
 * @module lib/@ralph/router/router
 * @description Main model router that combines rules, history, and cascade
 */

import { createCascadeDecision } from './cascade';
import { analyzeHistory, createTaskSignature, getBestModelFromHistory } from './history';
import { calculateTaskScore, compareTiers, DEFAULT_MODELS } from './rules';
import type { ModelPreference, RoutingDecision, TaskAttributes } from './types';

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

  return (
    `Task: ${decision.taskId}\n` +
    `  Model: ${decision.selectedModel} (${decision.tier})\n` +
    `  Source: ${decision.source}\n` +
    `  Score: ${decision.score}\n` +
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
    lines.push(`  <task id="${decision.taskId}">`);
    lines.push(`    <model>${decision.selectedModel}</model>`);
    lines.push(`    <tier>${decision.tier}</tier>`);
    lines.push(`    <source>${decision.source}</source>`);
    lines.push(`    <score>${decision.score}</score>`);
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
  escalatable: number;
} {
  const byTier: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let escalatable = 0;

  for (const decision of decisions) {
    byTier[decision.tier] = (byTier[decision.tier] ?? 0) + 1;
    byModel[decision.selectedModel] = (byModel[decision.selectedModel] ?? 0) + 1;
    bySource[decision.source] = (bySource[decision.source] ?? 0) + 1;
    if (decision.canEscalate) escalatable++;
  }

  return {
    totalTasks: decisions.length,
    byTier,
    byModel,
    bySource,
    escalatable,
  };
}
