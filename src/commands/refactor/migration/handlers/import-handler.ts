/**
 * @module commands/refactor/migration/handlers/import-handler
 * @description Import update handler
 *
 * Handles bulk import statement updates.
 */

import type { MigrationAction } from '../../core/types';
import type { ExecutionResult } from '../core/types';
import { executeImportUpdates } from './shared';

/**
 * Execute update-imports action
 *
 * Updates import statements across multiple files.
 *
 * @param action - Migration action
 * @param projectRoot - Project root path
 * @param libPath - Library path
 * @param dryRun - Dry run mode
 */
export async function executeUpdateImports(
  action: MigrationAction,
  projectRoot: string,
  libPath: string,
  dryRun: boolean,
): Promise<ExecutionResult> {
  return executeImportUpdates(action, projectRoot, libPath, dryRun, {
    dryRun: `Would update ${action.affectedImports.length} import statements`,
    success: `Updated {count} import statements`,
  });
}
