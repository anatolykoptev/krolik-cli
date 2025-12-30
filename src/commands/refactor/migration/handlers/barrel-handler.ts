/**
 * @module commands/refactor/migration/handlers/barrel-handler
 * @description Barrel creation handler
 *
 * Handles creation of barrel (index.ts) exports for directories.
 */

import * as path from 'node:path';
import { exists, findFiles, readFile, writeFile } from '../../../../lib/@core/fs';
import type { MigrationAction } from '../../core/types';
import { analyzeExports, generateBarrelContent, generateExportStatement } from '../barrel';
import type { ExecutionResult } from '../core/types';
import { validatePath } from '../security';

/**
 * Execute create-barrel action
 *
 * Creates a barrel (index.ts) file for a directory by analyzing all .ts files
 * and generating appropriate export statements.
 *
 * @param action - Migration action
 * @param libPath - Library path
 * @param dryRun - Dry run mode
 */
export async function executeCreateBarrel(
  action: MigrationAction,
  libPath: string,
  dryRun: boolean,
): Promise<ExecutionResult> {
  const indexPath = validatePath(libPath, path.join(action.source, 'index.ts'));

  if (exists(indexPath)) {
    return { success: true, message: `Barrel already exists: ${action.source}/index.ts` };
  }

  if (dryRun) {
    return {
      success: true,
      message: `Would create barrel export: ${action.source}/index.ts`,
    };
  }

  // Find all .ts files in directory
  const dirPath = validatePath(libPath, action.source);
  const files = await findFiles(dirPath, {
    extensions: ['.ts'],
    skipDirs: [],
  });

  // Filter and create exports
  const sourceFiles = files
    .filter((f) => !f.endsWith('.d.ts') && !f.endsWith('.test.ts') && !f.endsWith('.spec.ts'))
    .filter((f) => path.basename(f) !== 'index.ts');

  // Analyze files for export types and generate statements
  const exports: string[] = [];
  for (const file of sourceFiles) {
    const name = path.basename(file, '.ts');
    const content = readFile(file);

    if (!content) continue;

    const { hasDefault, hasNamed } = analyzeExports(content);
    const statements = generateExportStatement(name, hasDefault, hasNamed);
    exports.push(...statements);
  }

  const barrelContent = generateBarrelContent(path.basename(action.source), exports);

  const writeSuccess = writeFile(indexPath, barrelContent);
  if (!writeSuccess) {
    return { success: false, message: `Failed to create barrel: ${action.source}` };
  }

  return {
    success: true,
    message: `Created barrel export: ${action.source}/index.ts (${exports.length} exports)`,
  };
}
