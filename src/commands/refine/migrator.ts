/**
 * @module commands/refine/migrator
 * @description Apply structure migrations (move directories, update imports)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Logger } from '../../types';
import type { MigrationPlan, RefineResult } from './types';
import { escapeRegex } from '@/lib';

// ============================================================================
// CONSTANTS
// ============================================================================

const SKIP_DIRS = [
  'node_modules', '.git', '.next', 'dist', 'build', 'coverage',
  '__tests__', '__mocks__', '.turbo', '.cache',
];

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Find all TypeScript files in project
 */
export function findAllTsFiles(projectRoot: string): string[] {
  const files: string[] = [];

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.includes(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(projectRoot);
  return files;
}

/**
 * Create directory if not exists
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Move directory to new location
 */
function moveDirectory(from: string, to: string): void {
  ensureDir(path.dirname(to));
  fs.renameSync(from, to);
}

// ============================================================================
// IMPORT UPDATES
// ============================================================================

/**
 * Update imports in a file
 */
export function updateFileImports(
  filePath: string,
  updates: MigrationPlan['importUpdates'],
): boolean {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;

  for (const { oldPath, newPath } of updates) {
    // Match import statements with optional subpath
    const regex = new RegExp(
      `(from\\s+['"])${escapeRegex(oldPath)}(/[^'"]*)?(['"])`,
      'g'
    );

    if (regex.test(content)) {
      regex.lastIndex = 0; // Reset after test
      content = content.replace(regex, `$1${newPath}$2$3`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return modified;
}

/**
 * Update all imports in project
 */
export function updateAllImports(
  projectRoot: string,
  updates: MigrationPlan['importUpdates'],
  logger?: Logger,
): number {
  const files = findAllTsFiles(projectRoot);
  let updatedCount = 0;

  for (const file of files) {
    if (updateFileImports(file, updates)) {
      updatedCount++;
      logger?.debug(`Updated imports: ${path.relative(projectRoot, file)}`);
    }
  }

  return updatedCount;
}

// ============================================================================
// MIGRATION
// ============================================================================

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  movedDirs: string[];
  updatedFiles: number;
  errors: string[];
}

/**
 * Apply migration plan
 */
export function applyMigration(
  result: RefineResult,
  dryRun: boolean,
  logger?: Logger,
): MigrationResult {
  if (!result.libDir) {
    return {
      success: false,
      movedDirs: [],
      updatedFiles: 0,
      errors: ['No lib directory found'],
    };
  }

  const { plan, libDir, projectRoot } = result;
  const migrationResult: MigrationResult = {
    success: true,
    movedDirs: [],
    updatedFiles: 0,
    errors: [],
  };

  if (plan.moves.length === 0) {
    logger?.info('No migrations needed - structure is already optimized');
    return migrationResult;
  }

  // 1. Create namespace directories
  const namespaces = new Set(plan.moves.map(m => m.to.split('/')[0]));
  for (const ns of namespaces) {
    const nsPath = path.join(libDir, ns);
    if (dryRun) {
      logger?.info(`[DRY] Would create: ${ns}/`);
    } else {
      ensureDir(nsPath);
      logger?.success(`Created: ${ns}/`);
    }
  }

  // 2. Move directories
  for (const move of plan.moves) {
    const fromPath = path.join(libDir, move.from);
    const toPath = path.join(libDir, move.to);

    if (!fs.existsSync(fromPath)) {
      migrationResult.errors.push(`Source not found: ${move.from}`);
      continue;
    }

    if (dryRun) {
      logger?.info(`[DRY] Would move: ${move.from} -> ${move.to}`);
    } else {
      try {
        moveDirectory(fromPath, toPath);
        migrationResult.movedDirs.push(move.to);
        logger?.success(`Moved: ${move.from} -> ${move.to}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        migrationResult.errors.push(`Failed to move ${move.from}: ${msg}`);
        migrationResult.success = false;
      }
    }
  }

  // 3. Update imports
  if (!dryRun && plan.importUpdates.length > 0) {
    logger?.info('Updating imports...');
    migrationResult.updatedFiles = updateAllImports(
      projectRoot,
      plan.importUpdates,
      logger,
    );
    logger?.success(`Updated imports in ${migrationResult.updatedFiles} files`);
  } else if (dryRun && plan.importUpdates.length > 0) {
    logger?.info(`[DRY] Would update ${plan.importUpdates.length} import patterns`);
  }

  if (migrationResult.errors.length > 0) {
    migrationResult.success = false;
  }

  return migrationResult;
}

/**
 * Preview migration (dry run output)
 */
export function previewMigration(
  result: RefineResult,
  logger: Logger,
): void {
  if (!result.libDir) {
    logger.error('No lib directory found');
    return;
  }

  if (result.plan.moves.length === 0) {
    logger.success('No migrations needed - structure is already optimized!');
    return;
  }

  logger.section('Migration Preview');

  // Show moves
  for (const move of result.plan.moves) {
    logger.info(`${move.from}/ → ${move.to}/`);
    logger.debug(`  Reason: ${move.reason}`);
  }

  // Show import updates
  if (result.plan.importUpdates.length > 0) {
    logger.info('');
    logger.info(`Import patterns to update: ${result.plan.importUpdates.length}`);
    for (const update of result.plan.importUpdates.slice(0, 5)) {
      logger.debug(`  ${update.oldPath} → ${update.newPath}`);
    }
    if (result.plan.importUpdates.length > 5) {
      logger.debug(`  ... and ${result.plan.importUpdates.length - 5} more`);
    }
  }

  logger.info('');
  logger.info(`Score: ${result.plan.score.before}% → ${result.plan.score.after}%`);
}
