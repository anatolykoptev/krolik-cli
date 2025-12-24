/**
 * @module commands/refactor/migration/execution
 * @description Migration execution and file operations
 *
 * Executes migration actions: move, merge, delete, create-barrel, update-imports
 */

import * as path from 'path';
import type { MigrationAction, MigrationPlan } from '../core';
import { validatePath, safeDelete, createBackup } from './security';
import { updateImports, updateInternalImports } from './imports';
import { updateBarrelFile } from './barrel';
import {
  findFiles,
  readFile,
  writeFile,
  exists,
  ensureDir,
  logger,
  isDirectory,
} from '../../../lib';
import { MigrationExecutionOptions } from "../core/options";

// ============================================================================
// TYPES
// ============================================================================

export interface ExecutionResult {
  success: boolean;
  message: string;
}

export interface MigrationExecutionResult {
  success: boolean;
  results: string[];
}

// ============================================================================
// ACTION EXECUTION
// ============================================================================

/**
 * Execute a migration action with security validation
 */
export async function executeMigrationAction(
  action: MigrationAction,
  projectRoot: string,
  options: MigrationExecutionOptions = {},
): Promise<ExecutionResult> {
  const { dryRun = false, backup = true } = options;
  const libPath = path.join(projectRoot, 'src', 'lib');

  try {
    switch (action.type) {
      case 'move':
        return executeMove(action, libPath, projectRoot, dryRun, backup);

      case 'merge':
        return executeMerge(action, projectRoot, dryRun);

      case 'create-barrel':
        return executeCreateBarrel(action, libPath, dryRun);

      case 'update-imports':
        return executeUpdateImports(action, projectRoot, dryRun);

      case 'delete':
        return executeDelete(action, libPath, dryRun, backup);

      default:
        return { success: false, message: 'Unknown action type' };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, message: `Error: ${message}` };
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

async function executeMove(
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
    const result = await updateImports(affected, action.source, action.target!, projectRoot);
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

async function moveDirectory(
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

async function moveSingleFile(
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

async function executeMerge(
  action: MigrationAction,
  projectRoot: string,
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
    const result = await updateImports(affected, action.source, action.target!, projectRoot);
    if (result.changed) updatedCount++;
  }

  return {
    success: true,
    message: `Merged imports from ${action.source} to ${action.target} (${updatedCount} files)`,
  };
}

async function executeCreateBarrel(
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

  // Analyze files for default exports
  const exports: string[] = [];
  for (const file of sourceFiles) {
    const name = path.basename(file, '.ts');
    const content = readFile(file);

    if (!content) continue;

    const hasDefaultExport = /export\s+default\s+/.test(content);
    const hasNamedExports = /export\s+(const|function|class|interface|type|enum)/.test(content);

    if (hasDefaultExport && hasNamedExports) {
      exports.push(`export { default as ${name} } from './${name}';`);
      exports.push(`export * from './${name}';`);
    } else if (hasDefaultExport) {
      exports.push(`export { default as ${name} } from './${name}';`);
    } else if (hasNamedExports) {
      exports.push(`export * from './${name}';`);
    }
  }

  const barrelContent = `/**
 * @module ${path.basename(action.source)}
 * @description Auto-generated barrel export
 */

${exports.join('\n')}
`;

  const writeSuccess = writeFile(indexPath, barrelContent);
  if (!writeSuccess) {
    return { success: false, message: `Failed to create barrel: ${action.source}` };
  }

  return {
    success: true,
    message: `Created barrel export: ${action.source}/index.ts (${exports.length} exports)`,
  };
}

async function executeUpdateImports(
  action: MigrationAction,
  projectRoot: string,
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
    const result = await updateImports(affected, action.source, action.target!, projectRoot);
    if (result.changed) updated++;
  }

  return {
    success: true,
    message: `Updated ${updated} import statements`,
  };
}

async function executeDelete(
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

// ============================================================================
// PLAN EXECUTION
// ============================================================================

/**
 * Execute full migration plan
 */
export async function executeMigrationPlan(
  plan: MigrationPlan,
  projectRoot: string,
  options: MigrationExecutionOptions = {},
): Promise<MigrationExecutionResult> {
  const { dryRun = false, verbose = false, backup = true } = options;
  const results: string[] = [];
  let allSuccess = true;
  const movedFiles: Array<{ from: string; to: string }> = [];

  // Log start
  if (verbose) {
    logger.info(`\nExecuting ${plan.actions.length} migration actions...`);
  }

  for (const action of plan.actions) {
    const result = await executeMigrationAction(action, projectRoot, { dryRun, backup });
    results.push(result.message);

    if (!result.success) {
      allSuccess = false;
      if (verbose) {
        logger.error(`  ❌ ${result.message}`);
      }
    } else {
      if (verbose) {
        logger.info(`  ✅ ${result.message}`);
      }

      // Track moved files for barrel update
      if (action.type === 'move' && action.target) {
        movedFiles.push({ from: action.source, to: action.target });
      }
    }
  }

  // Update barrel file after all moves
  if (!dryRun && movedFiles.length > 0) {
    const barrelUpdated = await updateBarrelFile(projectRoot, movedFiles);
    if (barrelUpdated) {
      results.push('Updated lib/index.ts barrel exports');
      if (verbose) {
        logger.info('  ✅ Updated lib/index.ts barrel exports');
      }
    }
  }

  return { success: allSuccess, results };
}
