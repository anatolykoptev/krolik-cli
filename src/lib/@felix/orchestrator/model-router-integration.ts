/**
 * Model Router Integration
 *
 * Bridges the Model Router with the Felix Orchestrator.
 * Handles per-task model selection and cascade escalation.
 *
 * @module @felix/orchestrator/model-router-integration
 */

import type { BaseLlm } from '@google/adk';
import type { LlmFactory } from '../models/llm-factory.js';
import { getModelTier } from '../router/model-tiers.js';
import { type PRDRoutingPlan, routePRD, routeTask } from '../router/router.js';
import type {
  ModelName,
  RoutingDecision,
  TaskAttributes,
  TaskComplexity,
} from '../router/types.js';
import type { PRD, PRDTask } from '../schemas/prd.schema.js';
import { createComponentLogger } from '../utils/logger.js';

const logger = createComponentLogger('model-router');

// ============================================================================
// TYPES
// ============================================================================

export interface ModelRouterIntegration {
  /** Route entire PRD and determine execution mode */
  routePRD(prd: PRD): PRDRoutingPlan;
  /** Get LLM for a specific task based on routing decision */
  getLlmForTask(task: PRDTask): { llm: BaseLlm; decision: RoutingDecision };
  /** Get LLM for a pre-computed routing decision */
  getLlmForDecision(decision: RoutingDecision): BaseLlm;
  /** Get escalated LLM after a failure */
  getEscalatedLlm(decision: RoutingDecision): { llm: BaseLlm; newDecision: RoutingDecision } | null;
  /** Log routing decision */
  logDecision(decision: RoutingDecision): void;
  /** Record attempt result for history learning */
  recordAttempt(decision: RoutingDecision, success: boolean, costUsd: number): void;
}

export interface ModelRouterConfig {
  factory: LlmFactory;
  projectPath: string;
  backend: 'cli' | 'api';
  defaultModel?: ModelName;
  enableCascade?: boolean;
  verbose?: boolean;
}

// ============================================================================
// PRD TASK TO TASK ATTRIBUTES CONVERTER
// ============================================================================

/**
 * Convert PRDTask to TaskAttributes for routing
 */
export function prdTaskToAttributes(task: PRDTask): TaskAttributes {
  return {
    id: task.id,
    complexity: task.complexity as TaskComplexity | undefined,
    filesAffected: task.files_affected,
    acceptanceCriteria: task.acceptance_criteria.map((ac) =>
      typeof ac === 'string' ? ac : ac.description,
    ),
    tags: task.tags ?? task.labels,
  };
}

// ============================================================================
// MODEL ROUTER INTEGRATION
// ============================================================================

/**
 * Create model router integration for the orchestrator
 */
export function createModelRouterIntegration(config: ModelRouterConfig): ModelRouterIntegration {
  const { factory, projectPath, backend, enableCascade = true, verbose = false } = config;

  return {
    routePRD(prd: PRD): PRDRoutingPlan {
      // Convert all PRD tasks to TaskAttributes
      const taskAttrs = prd.tasks.map(prdTaskToAttributes);

      // Route the entire PRD
      const plan = routePRD({
        tasks: taskAttrs,
        projectPath,
      });

      // Log the routing plan
      logger.info(`PRD routed: ${plan.overallMode} mode`, {
        totalTasks: plan.summary.totalTasks,
        byTier: plan.summary.byTier,
        byModel: plan.summary.byModel,
        reason: plan.overallPlan.reason,
      });

      // Log cost estimate
      const cost = plan.costEstimate;
      logger.info(`Cost estimate:`, {
        optimistic: `$${cost.optimistic.toFixed(4)}`,
        expected: `$${cost.expected.toFixed(4)}`,
        pessimistic: `$${cost.pessimistic.toFixed(4)}`,
      });

      // Log task breakdown if verbose
      if (verbose) {
        for (const decision of plan.taskDecisions) {
          this.logDecision(decision);
        }
        // Also log per-task cost breakdown
        for (const taskCost of cost.breakdown) {
          logger.info(
            `  Task ${taskCost.taskId}: ${taskCost.estimatedModel} ~${taskCost.estimatedTokens} tokens, $${taskCost.expectedCost.toFixed(4)} (${(taskCost.escalationProbability * 100).toFixed(0)}% escalation risk)`,
          );
        }
      }

      return plan;
    },

    getLlmForTask(task: PRDTask): { llm: BaseLlm; decision: RoutingDecision } {
      // Convert PRDTask to TaskAttributes
      const taskAttrs = prdTaskToAttributes(task);

      // Route the task
      const decision = routeTask({
        task: taskAttrs,
        projectPath,
      });

      // Log decision if verbose
      if (verbose) {
        this.logDecision(decision);
      }

      // Get LLM from factory
      const modelName = decision.selectedModel;
      const llm = factory.create(modelName, { backend });

      logger.info(`Routed task to ${modelName}`, {
        taskId: task.id,
        model: modelName,
        tier: decision.tier,
        source: decision.source,
        score: decision.score,
        canEscalate: decision.canEscalate,
        executionMode: decision.execution.mode,
      });

      return { llm, decision };
    },

    getLlmForDecision(decision: RoutingDecision): BaseLlm {
      return factory.create(decision.selectedModel, { backend });
    },

    getEscalatedLlm(
      decision: RoutingDecision,
    ): { llm: BaseLlm; newDecision: RoutingDecision } | null {
      if (!enableCascade) {
        logger.debug('Cascade disabled, not escalating', { taskId: decision.taskId });
        return null;
      }

      if (!decision.canEscalate || decision.escalationPath.length === 0) {
        logger.debug('No escalation path available', { taskId: decision.taskId });
        return null;
      }

      // Get next model in escalation path
      const nextModel = decision.escalationPath[0];
      if (!nextModel) {
        return null;
      }

      // Create new decision for escalated model (preserve execution plan)
      const newDecision: RoutingDecision = {
        taskId: decision.taskId,
        selectedModel: nextModel,
        tier: getModelTier(nextModel),
        source: 'escalation',
        score: decision.score,
        canEscalate: decision.escalationPath.length > 1,
        escalationPath: decision.escalationPath.slice(1),
        execution: decision.execution, // Preserve execution plan
      };

      const llm = factory.create(nextModel, { backend });

      logger.info(`Escalating task from ${decision.selectedModel} to ${nextModel}`, {
        taskId: decision.taskId,
        from: decision.selectedModel,
        to: nextModel,
        remainingPath: newDecision.escalationPath,
      });

      return { llm, newDecision };
    },

    logDecision(decision: RoutingDecision): void {
      const pathStr =
        decision.escalationPath.length > 0
          ? ` → [${decision.escalationPath.join(' → ')}]`
          : ' (no escalation)';

      const execStr = ` [${decision.execution.mode}, agents=${decision.execution.suggestedAgentCount}]`;

      logger.info(
        `[Router] Task ${decision.taskId}: ${decision.selectedModel} (${decision.tier}) via ${decision.source}, score=${decision.score}${execStr}${pathStr}`,
      );
    },

    recordAttempt(decision: RoutingDecision, success: boolean, costUsd: number): void {
      // Import dynamically to avoid circular dependencies
      import('../router/history.js')
        .then(({ updateRoutingPattern }) => {
          updateRoutingPattern(
            decision.taskId, // Using taskId as signature hash
            decision.selectedModel,
            success,
            costUsd,
            projectPath,
          );
        })
        .catch((err) => {
          logger.warn(`Failed to record routing result: ${err}`);
        });
    },
  };
}
