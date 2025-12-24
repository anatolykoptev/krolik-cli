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
  validatePath,
  safeDelete,
  createBackup,
  restoreFromBackup,
  removeBackup,
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

export type {
  ExecutionResult,
  MigrationExecutionOptions,
  MigrationExecutionResult,
} from './execution';

export {
  executeMigrationAction,
  executeMigrationPlan,
} from './execution';

// ============================================================================
// BARREL
// ============================================================================

export {
  updateBarrelFile,
  generateBarrelContent,
  analyzeExports,
  generateExportStatement,
} from './barrel';

// ============================================================================
// TYPE MIGRATION
// ============================================================================

export {
  createTypeMigrationPlan,
  filterSafeTypeMigrations,
  previewTypeMigrationPlan,
} from './type-planning';

export {
  executeTypeMigrationPlan,
} from './type-execution';
