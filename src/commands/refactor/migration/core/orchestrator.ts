/**
 * @module commands/refactor/migration/core/orchestrator
 * @description Migration action orchestration and plan execution
 *
 * Coordinates migration execution by routing actions to appropriate handlers.
 */

import { logger } from '../../../../lib';
import type { MigrationAction, MigrationPlan } from '../../core';
import type { MigrationOptions } from '../../core/options';
import { updateBarrelFile } from '../barrel';
import { executeCreateBarrel } from '../handlers/barrel-handler';
import { executeDelete } from '../handlers/delete-handler';
import { executeUpdateImports } from '../handlers/import-handler';
import { executeMerge } from '../handlers/merge-handler';
import { executeMove } from '../handlers/move-handler';

// Type alias for backwards compatibility (exported for public API)
export type MigrationExecutionOptions = MigrationOptions;

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
  libPath: string,
  options: MigrationExecutionOptions = {},
): Promise<ExecutionResult> {
  const { dryRun = false } = options;
  const backup = true; // Always backup when applying changes

  try {
    switch (action.type) {
      case 'move':
        return executeMove(action, libPath, projectRoot, dryRun, backup);

      case 'merge':
        return executeMerge(action, projectRoot, libPath, dryRun);

      case 'create-barrel':
        return executeCreateBarrel(action, libPath, dryRun);

      case 'update-imports':
        return executeUpdateImports(action, projectRoot, libPath, dryRun);

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
// PLAN EXECUTION
// ============================================================================

/**
 * Execute full migration plan
 */
export async function executeMigrationPlan(
  plan: MigrationPlan,
  projectRoot: string,
  libPath: string,
  options: MigrationExecutionOptions = {},
): Promise<MigrationExecutionResult> {
  const { dryRun = false, verbose = false } = options;
  // Note: backup is now always-on inside individual action handlers
  const results: string[] = [];
  let allSuccess = true;
  const movedFiles: Array<{ from: string; to: string }> = [];

  // Log start
  if (verbose) {
    logger.info(`\nExecuting ${plan.actions.length} migration actions...`);
  }

  for (const action of plan.actions) {
    const result = await executeMigrationAction(action, projectRoot, libPath, { dryRun });
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
    const barrelUpdated = await updateBarrelFile(libPath, movedFiles);
    if (barrelUpdated) {
      results.push('Updated lib/index.ts barrel exports');
      if (verbose) {
        logger.info('  ✅ Updated lib/index.ts barrel exports');
      }
    }
  }

  return { success: allSuccess, results };
}
