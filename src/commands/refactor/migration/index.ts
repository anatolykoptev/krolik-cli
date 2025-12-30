/**
 * @module commands/refactor/migration
 * @description Migration planning and execution
 *
 * Exports:
 * - Planning: createMigrationPlan, filterSafeActions, sortByRisk
 * - Imports: findAffectedImports, updateImports
 * - Execution: executeMigrationAction, executeMigrationPlan
 * - Security: validatePath, safeDelete, createBackup
 * - Barrel: updateBarrelFile
 */

// ============================================================================
// SECURITY
// ============================================================================

export {
  createBackup,
  removeBackup,
  restoreFromBackup,
  safeDelete,
  validatePath,
} from './security';

// ============================================================================
// PLANNING
// ============================================================================

export {
  createMigrationPlan,
  filterSafeActions,
  sortByRisk,
} from './planning';

// ============================================================================
// IMPORTS
// ============================================================================

export type { UpdateImportsResult } from './imports';

export {
  findAffectedImports,
  updateImports,
  updateInternalImports,
} from './imports';

// ============================================================================
// EXECUTION
// ============================================================================

export {
  executeMigrationAction,
  executeMigrationPlan,
} from './core/orchestrator';
export type {
  ExecutionResult,
  MigrationExecutionOptions,
  MigrationExecutionResult,
} from './core/types';

// ============================================================================
// BARREL
// ============================================================================

export {
  analyzeExports,
  generateBarrelContent,
  generateExportStatement,
  updateBarrelFile,
} from './barrel';

// ============================================================================
// TYPE MIGRATION
// ============================================================================

export { executeTypeMigrationPlan } from './type-execution';
export {
  createTypeMigrationPlan,
  filterSafeTypeMigrations,
  previewTypeMigrationPlan,
} from './type-planning';
