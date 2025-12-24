/**
 * @module commands/fix/composite/transaction
 * @description Transaction manager for atomic composite transforms
 *
 * Provides:
 * - File backup before modification
 * - Atomic commit (all-or-nothing)
 * - Rollback on failure
 * - State tracking
 */

import * as fs from 'node:fs';
import { applyFix } from '../applier';
import { isTscAvailable, runTypeCheck } from '../strategies/shared';
import type {
  CompositeResult,
  CompositeStep,
  CompositeTransform,
  FileBackup,
  StepResult,
  Transaction,
  VerificationResult,
} from './types';

// ============================================================================
// TRANSACTION ID
// ============================================================================

/**
 * Generate unique transaction ID
 */
function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `tx-${timestamp}-${random}`;
}

// ============================================================================
// FILE BACKUP
// ============================================================================

/**
 * Create backup of a file
 */
function backupFile(filePath: string): FileBackup {
  const exists = fs.existsSync(filePath);

  return {
    path: filePath,
    content: exists ? fs.readFileSync(filePath, 'utf-8') : null,
    isNew: !exists,
  };
}

/**
 * Restore file from backup
 */
function restoreFile(backup: FileBackup): void {
  if (backup.isNew) {
    // File was created - delete it
    if (fs.existsSync(backup.path)) {
      fs.unlinkSync(backup.path);
    }
  } else if (backup.content !== null) {
    // File existed - restore content
    fs.writeFileSync(backup.path, backup.content);
  }
}

// ============================================================================
// TRANSACTION MANAGER
// ============================================================================

/**
 * Begin a new transaction for a composite transform
 */
export function beginTransaction(transform: CompositeTransform): Transaction {
  const backups: FileBackup[] = [];

  // Backup all affected files
  for (const file of transform.affectedFiles) {
    backups.push(backupFile(file));
  }

  return {
    id: generateTransactionId(),
    transform,
    state: 'pending',
    backups,
    completedSteps: 0,
    startedAt: new Date(),
  };
}

/**
 * Rollback a transaction - restore all files to original state
 */
export function rollbackTransaction(transaction: Transaction): void {
  // Restore files in reverse order
  for (const backup of [...transaction.backups].reverse()) {
    try {
      restoreFile(backup);
    } catch {
      // Best effort - continue with other files
    }
  }

  transaction.state = 'rolled_back';
  transaction.completedAt = new Date();
}

/**
 * Commit a transaction - mark as complete
 */
export function commitTransaction(transaction: Transaction): void {
  transaction.state = 'committed';
  transaction.completedAt = new Date();
}

// ============================================================================
// STEP EXECUTION
// ============================================================================

/**
 * Execute a single composite step
 */
function executeStep(step: CompositeStep, index: number, transaction: Transaction): StepResult {
  const filesModified: string[] = [];

  try {
    // Backup any new files not in initial backup
    for (const file of step.files) {
      if (!transaction.backups.some((b) => b.path === file)) {
        transaction.backups.push(backupFile(file));
      }
    }

    // Apply operations
    if (step.operations) {
      for (const operation of step.operations) {
        const result = applyFix(operation, {
          file: operation.file,
          line: operation.line ?? 0,
          message: '',
          category: 'composite',
          severity: 'warning',
        });

        if (!result.success) {
          return {
            index,
            step,
            success: false,
            error: result.error ?? 'Unknown error',
            filesModified,
          };
        }

        if (!filesModified.includes(operation.file)) {
          filesModified.push(operation.file);
        }
      }
    }

    transaction.completedSteps = index + 1;

    return {
      index,
      step,
      success: true,
      filesModified,
    };
  } catch (error) {
    return {
      index,
      step,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      filesModified,
    };
  }
}

// ============================================================================
// VERIFICATION
// ============================================================================

/**
 * Run verification after composite transform
 */
function runVerification(
  transform: CompositeTransform,
  projectRoot: string,
): VerificationResult | undefined {
  const config = transform.verification;

  if (!config) return undefined;

  const result: VerificationResult = { success: true };

  // TypeScript check
  if (config.typecheck && isTscAvailable(projectRoot)) {
    const tsResult = runTypeCheck(projectRoot);
    result.typecheck = {
      success: tsResult.success,
      errors: tsResult.errorCount,
    };
    if (!tsResult.success) {
      result.success = false;
    }
  }

  // TODO: Add lint and test verification when needed

  return result;
}

// ============================================================================
// EXECUTE COMPOSITE TRANSFORM
// ============================================================================

/**
 * Execute a composite transform atomically
 *
 * All steps succeed → commit
 * Any step fails → rollback all
 */
export function executeCompositeTransform(
  transform: CompositeTransform,
  projectRoot: string,
): CompositeResult {
  const startTime = Date.now();

  // Begin transaction
  const transaction = beginTransaction(transform);
  transaction.state = 'in_progress';

  const stepResults: StepResult[] = [];

  try {
    // Execute steps in order
    for (let i = 0; i < transform.steps.length; i++) {
      const step = transform.steps[i]!;
      const result = executeStep(step, i, transaction);
      stepResults.push(result);

      if (!result.success) {
        // Step failed - rollback
        rollbackTransaction(transaction);

        return {
          transform,
          transaction,
          success: false,
          steps: stepResults,
          duration: Date.now() - startTime,
        };
      }
    }

    // All steps succeeded - run verification
    const verification = runVerification(transform, projectRoot);

    if (verification && !verification.success) {
      // Verification failed - rollback
      rollbackTransaction(transaction);
      transaction.error = 'Verification failed';

      return {
        transform,
        transaction,
        success: false,
        steps: stepResults,
        verification,
        duration: Date.now() - startTime,
      };
    }

    // All passed - commit
    commitTransaction(transaction);

    const result: CompositeResult = {
      transform,
      transaction,
      success: true,
      steps: stepResults,
      duration: Date.now() - startTime,
    };

    if (verification) {
      result.verification = verification;
    }

    return result;
  } catch (error) {
    // Unexpected error - rollback
    rollbackTransaction(transaction);
    transaction.error = error instanceof Error ? error.message : String(error);
    transaction.state = 'failed';

    return {
      transform,
      transaction,
      success: false,
      steps: stepResults,
      duration: Date.now() - startTime,
    };
  }
}

// ============================================================================
// DRY RUN
// ============================================================================

/**
 * Dry run - simulate without applying changes
 */
export function dryRunCompositeTransform(transform: CompositeTransform): {
  wouldModify: string[];
  steps: Array<{ description: string; files: string[] }>;
} {
  return {
    wouldModify: transform.affectedFiles,
    steps: transform.steps.map((step) => ({
      description: step.description,
      files: step.files,
    })),
  };
}
