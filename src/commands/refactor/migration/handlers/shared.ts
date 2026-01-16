/**
 * @module commands/refactor/migration/handlers/shared
 * @description Shared utilities for migration handlers
 */

import type { MigrationAction } from '../../core/types';
import type { ExecutionResult } from '../core/types';
import { updateImports } from '../imports';

/**
 * Execute import updates with configurable messages
 */
export async function executeImportUpdates(
  action: MigrationAction,
  projectRoot: string,
  libPath: string,
  dryRun: boolean,
  messages: {
    dryRun: string;
    success: string;
  },
): Promise<ExecutionResult> {
  if (dryRun) {
    return {
      success: true,
      message: messages.dryRun,
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
    message: messages.success.replace('{count}', updatedCount.toString()),
  };
}
