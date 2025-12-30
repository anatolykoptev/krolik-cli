/**
 * @module commands/refactor/migration/operations/directory-mover
 * @description Directory move operations
 *
 * Handles moving entire directories with file processing.
 */

import * as path from 'node:path';
import { ensureDir, findFiles, readFile, writeFile } from '../../../../lib/@core/fs';
import { updateInternalImports } from '../imports';
import { safeDelete } from '../security';

/**
 * Move a directory from source to target
 *
 * Recursively moves all .ts files, updating internal imports.
 *
 * @param sourceFull - Full path to source directory
 * @param targetFull - Full path to target directory
 * @param libPath - Library path for import calculations
 */
export async function moveDirectory(
  sourceFull: string,
  targetFull: string,
  libPath: string,
): Promise<void> {
  const files = findFiles(sourceFull, { extensions: ['.ts'] });

  for (const file of files) {
    const relativePath = path.relative(sourceFull, file);
    const newFilePath = path.join(targetFull, relativePath);

    ensureDir(path.dirname(newFilePath));

    let content = readFile(file);
    if (!content) continue;

    // Update internal imports in the file
    const oldRelPath = path.relative(libPath, file);
    const newRelPath = path.relative(libPath, newFilePath);
    content = updateInternalImports(content, oldRelPath, newRelPath);

    writeFile(newFilePath, content);
  }

  // Delete original directory
  safeDelete(sourceFull);
}
