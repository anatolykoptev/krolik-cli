/**
 * @module commands/refactor/migration/core
 * @description Migration orchestration exports
 */

export type {
  ExecutionResult,
  MigrationExecutionOptions,
  MigrationExecutionResult,
} from './orchestrator';

export {
  executeMigrationAction,
  executeMigrationPlan,
} from './orchestrator';
