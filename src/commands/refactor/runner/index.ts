/**
 * @module commands/refactor/runner
 * @description Analysis and migration execution for refactor command
 */

export { printAnalysis, runRefactor } from './analysis';
export {
  applyMigrations,
  applyTypeFixes,
  type MigrationOptions,
  type MigrationResult,
  type TypeFixOptions,
  type TypeFixResult,
} from './migration';
export {
  type RegistryRunnerOptions,
  type RegistryRunnerResult,
  runRegistryAnalysis,
} from './registry-runner';
