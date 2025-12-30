/**
 * @module commands/refactor/migration/handlers/import-handler
 * @description Import update handler
 *
 * Handles bulk import statement updates.
 */

import type { MigrationAction } from '../../core/types';
import type { ExecutionResult } from '../core/types';
import { updateImports } from '../imports';

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
  if (dryRun) {
    return {
      success: true,
      message: `Would update ${action.affectedImports.length} import statements`,
    };
  }

  let updated = 0;
  for (const affected of action.affectedImports) {
    const result = await updateImports(
      affected,
      action.source,
      action.target!,
      projectRoot,
      libPath,
    );
    if (result.changed) updated++;
  }

  return {
    success: true,
    message: `Updated ${updated} import statements`,
  };
}
