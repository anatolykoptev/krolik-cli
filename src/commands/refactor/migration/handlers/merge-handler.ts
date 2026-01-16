/**
 * @module commands/refactor/migration/handlers/merge-handler
 * @description Merge action handler
 *
 * Handles merging imports from one module to another.
 */

import type { MigrationAction } from '../../core/types';
import type { ExecutionResult } from '../core/types';
import { executeImportUpdates } from './shared';

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
  return executeImportUpdates(action, projectRoot, libPath, dryRun, {
    dryRun: `Would merge ${action.source} into ${action.target}`,
    success: `Merged imports from ${action.source} to ${action.target} ({count} files)`,
  });
}
