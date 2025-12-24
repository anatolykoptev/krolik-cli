/**
 * @module commands/fix/agent
 * @description AI plan execution agent
 *
 * Parses AI-generated improvement plans and executes them
 * with verification and rollback capabilities.
 *
 * @example
 * ```typescript
 * import {
 *   parsePlanFile,
 *   executePlan,
 *   previewPlan,
 * } from './agent';
 *
 * // Parse plan file
 * const result = parsePlanFile('.krolik/IMPROVEMENT-PLAN.md');
 *
 * if (result.success) {
 *   // Preview first
 *   console.log(previewPlan(result.plan));
 *
 *   // Execute with verification
 *   const execution = await executePlan(result.plan, {
 *     mode: 'batch',
 *     projectRoot: '/path/to/project',
 *     verifyEachStep: true,
 *     stopOnFailure: true,
 *     onProgress: (step, status) => {
 *       console.log(`Step ${step.number}: ${status}`);
 *     },
 *   });
 *
 *   if (execution.success) {
 *     console.log(`✅ Applied ${execution.stepsSucceeded} fixes`);
 *   } else {
 *     console.log(`❌ Failed: ${execution.stepsFailed} errors`);
 *   }
 * }
 * ```
 */

// Types
export type {
  StepPriority,
  StepStatus,
  StepAction,
  PlanStep,
  ImprovementPlan,
  ExecutionMode,
  StepExecutionResult,
  PlanExecutionResult,
  PlanFormat,
  ParseResult,
  StepProgressCallback,
  ConfirmCallback,
  ExecutorOptions,
} from './types';

// Parser
export {
  detectFormat,
  parsePlanFile,
  parsePlan,
} from './parser';

// Executor
export {
  executePlan,
  previewPlan,
} from './executor';
