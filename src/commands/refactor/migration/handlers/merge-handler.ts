/**
 * @module commands/refactor/migration/handlers/merge-handler
 * @description Merge action handler
 *
 * Handles merging imports from one module to another.
 */

import type { MigrationAction } from '../../core';
import type { ExecutionResult } from '../core/orchestrator';
import { updateImports } from '../imports';

/**
 * Execute merge action
 *
 * Merges imports from source to target without moving files.
 *
 * @param action - Migration action
 * @param projectRoot - Project root path
 * @param libPath - Library path
 * @param dryRun - Dry run mode
 */
export async function executeMerge(
  action: MigrationAction,
  projectRoot: string,
  libPath: string,
  dryRun: boolean,
): Promise<ExecutionResult> {
  if (dryRun) {
    return {
      success: true,
      message: `Would merge ${action.source} into ${action.target}`,
    };
  }

  let updatedCount = 0;
  for (const affected of action.affectedImports) {
    const result = await updateImports(
      affected,
      action.source,
      action.target!,
      projectRoot,
      libPath,
    );
    if (result.changed) updatedCount++;
  }

  return {
    success: true,
    message: `Merged imports from ${action.source} to ${action.target} (${updatedCount} files)`,
  };
}
