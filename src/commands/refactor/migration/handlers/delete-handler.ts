/**
 * @module commands/refactor/migration/handlers/delete-handler
 * @description Delete action handler
 *
 * Handles safe deletion of files and directories.
 */

import { logger } from '../../../../lib';
import type { MigrationAction } from '../../core';
import type { ExecutionResult } from '../core/orchestrator';
import { createBackup, safeDelete, validatePath } from '../security';

/**
 * Execute delete action
 *
 * Safely deletes a file or directory with optional backup.
 *
 * @param action - Migration action
 * @param libPath - Library path
 * @param dryRun - Dry run mode
 * @param backup - Whether to create backup
 */
export async function executeDelete(
  action: MigrationAction,
  libPath: string,
  dryRun: boolean,
  backup: boolean,
): Promise<ExecutionResult> {
  const targetPath = validatePath(libPath, action.source);

  if (dryRun) {
    return {
      success: true,
      message: `Would delete ${action.source}`,
    };
  }

  // Create backup before delete
  if (backup) {
    const backupPath = createBackup(targetPath);
    if (backupPath) {
      logger.info(`Backup created: ${backupPath}`);
    }
  }

  const deleteSuccess = safeDelete(targetPath);
  if (!deleteSuccess) {
    return { success: false, message: `Failed to delete: ${action.source}` };
  }

  return {
    success: true,
    message: `Deleted: ${action.source}`,
  };
}
