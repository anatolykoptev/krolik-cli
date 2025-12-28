/**
 * @module commands/refactor/migration/handlers/move-handler
 * @description Move action handler
 *
 * Handles file and directory move operations with import updates.
 */

import * as path from 'node:path';
import { ensureDir, exists, isDirectory, logger } from '../../../../lib';
import type { MigrationAction } from '../../core';
import type { ExecutionResult } from '../core/orchestrator';
import { updateImports } from '../imports';
import { moveDirectory } from '../operations/directory-mover';
import { moveSingleFile } from '../operations/file-mover';
import { createBackup, validatePath } from '../security';

/**
 * Execute move action
 *
 * Moves a file or directory from source to target, updating all affected imports.
 *
 * @param action - Migration action
 * @param libPath - Library path
 * @param projectRoot - Project root path
 * @param dryRun - Dry run mode
 * @param backup - Whether to create backup
 */
export async function executeMove(
  action: MigrationAction,
  libPath: string,
  projectRoot: string,
  dryRun: boolean,
  backup: boolean,
): Promise<ExecutionResult> {
  // Validate paths to prevent traversal
  const sourceFull = validatePath(libPath, action.source);
  const targetFull = validatePath(libPath, action.target!);

  // Validation
  if (!exists(sourceFull)) {
    return { success: false, message: `Source does not exist: ${action.source}` };
  }

  if (exists(targetFull)) {
    return {
      success: false,
      message: `Target already exists: ${action.target}. Cannot overwrite.`,
    };
  }

  if (dryRun) {
    return {
      success: true,
      message: `Would move ${action.source} → ${action.target}`,
    };
  }

  // Create backup if requested
  if (backup) {
    const backupPath = createBackup(sourceFull);
    if (!backupPath) {
      logger.warn(`Could not create backup for ${action.source}`);
    }
  }

  // Ensure target directory exists
  ensureDir(path.dirname(targetFull));

  // Check if source is a directory
  const sourceIsDir = isDirectory(sourceFull);

  if (sourceIsDir) {
    await moveDirectory(sourceFull, targetFull, libPath);
  } else {
    await moveSingleFile(sourceFull, targetFull, action.source, action.target!, libPath);
  }

  // Update imports in affected files
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
    if (!result.success) {
      logger.warn(`Failed to update imports in ${affected}: ${result.errors.join(', ')}`);
    }
  }

  return {
    success: true,
    message: `Moved ${action.source} → ${action.target} (${updatedCount} imports updated)`,
  };
}
