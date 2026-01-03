/**
 * @module commands/agent/orchestrator
 * @description Agent orchestrator module exports
 */

// Execution plan
export { createExecutionPlan, getAgentRecommendations } from './execution-plan';
// Formatters
export {
  formatOrchestrationJSON,
  formatOrchestrationText,
  formatOrchestrationXML,
} from './formatters';
// Task analysis
export {
  analyzeTask,
  collectCategories,
  determinePrimaryType,
  scoreTaskTypes,
  TASK_KEYWORDS,
} from './task-analysis';
// Types
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
} from './types';
