/**
 * @module commands/refactor/migration/operations/file-mover
 * @description Single file move operations
 *
 * Handles moving individual files with internal import updates.
 */

import { logger, readFile, writeFile } from '../../../../lib';
import { updateInternalImports } from '../imports';
import { safeDelete } from '../security';

/**
 * Move a single file from source to target
 *
 * @param sourceFull - Full path to source file
 * @param targetFull - Full path to target file
 * @param sourceRel - Relative path to source (for logging)
 * @param targetRel - Relative path to target (for logging)
 * @param _libPath - Library path (reserved for future use)
 */
export async function moveSingleFile(
  sourceFull: string,
  targetFull: string,
  sourceRel: string,
  targetRel: string,
  _libPath: string,
): Promise<void> {
  let content = readFile(sourceFull);
  if (!content) {
    throw new Error(`Failed to read source: ${sourceRel}`);
  }

  // Update internal imports in the moved file
  content = updateInternalImports(content, sourceRel, targetRel);

  // Write to target
  const writeSuccess = writeFile(targetFull, content);
  if (!writeSuccess) {
    throw new Error(`Failed to write target: ${targetRel}`);
  }

  // Delete original file
  const deleteSuccess = safeDelete(sourceFull);
  if (!deleteSuccess) {
    logger.warn(`Could not delete original file: ${sourceRel}`);
  }
}
