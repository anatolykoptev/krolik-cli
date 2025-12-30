/**
 * @module commands/refactor/migration/core
 * @description Migration orchestration exports
 */

export {
  executeMigrationAction,
  executeMigrationPlan,
} from './orchestrator';
export type {
  ExecutionResult,
  MigrationExecutionOptions,
  MigrationExecutionResult,
} from './types';
