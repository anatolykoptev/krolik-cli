/**
 * @module commands/fix/agent/executor
 * @description Execute AI-generated improvement plans
 *
 * Features:
 * - Step-by-step execution with progress tracking
 * - Verification after each step (optional)
 * - Rollback on failure
 * - Interactive mode with confirmation prompts
 * - Dry-run mode for previewing changes
 */

import * as fs from 'node:fs';
import { applyFix } from '../applier';
import type { FileBackup } from '../composite';
import type { FixOperation } from '../core';
import { isTscAvailable, runTypeCheck } from '../strategies/shared';
import type {
  ExecutorOptions,
  ImprovementPlan,
  PlanExecutionResult,
  PlanStep,
  StepExecutionResult,
} from './types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create file backup
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
    if (fs.existsSync(backup.path)) {
      fs.unlinkSync(backup.path);
    }
  } else if (backup.content !== null) {
    fs.writeFileSync(backup.path, backup.content);
  }
}

/**
 * Convert PlanStep to FixOperation
 */
function stepToOperation(step: PlanStep): FixOperation | null {
  if (step.files.length === 0) return null;

  const file = step.files[0]!;

  switch (step.action) {
    case 'replace':
    case 'fix':
      if (step.line && step.endLine && step.newCode) {
        return {
          file,
          action: 'replace-range',
          line: step.line,
          endLine: step.endLine,
          newCode: step.newCode,
          oldCode: step.originalCode,
        };
      }
      if (step.line && step.newCode) {
        return {
          file,
          action: 'replace-line',
          line: step.line,
          newCode: step.newCode,
          oldCode: step.originalCode,
        };
      }
      break;

    case 'delete':
      if (step.line) {
        return {
          file,
          action: 'delete-line',
          line: step.line,
        };
      }
      break;

    case 'add':
      if (step.line && step.newCode) {
        return {
          file,
          action: 'insert-after',
          line: step.line,
          newCode: step.newCode,
        };
      }
      break;

    default:
      // For complex actions (rename, move, extract), use custom handling
      return null;
  }

  return null;
}

/**
 * Generate preview for a step
 */
function generatePreview(step: PlanStep): string {
  const lines: string[] = [];

  lines.push(`Step ${step.number}: ${step.description}`);
  lines.push(`Action: ${step.action}`);
  lines.push(`Priority: ${step.priority}`);

  if (step.files.length > 0) {
    lines.push(`File(s): ${step.files.join(', ')}`);
  }

  if (step.line) {
    lines.push(`Line: ${step.line}${step.endLine ? `-${step.endLine}` : ''}`);
  }

  if (step.originalCode) {
    lines.push('');
    lines.push('Before:');
    lines.push('```');
    lines.push(step.originalCode);
    lines.push('```');
  }

  if (step.newCode) {
    lines.push('');
    lines.push('After:');
    lines.push('```');
    lines.push(step.newCode);
    lines.push('```');
  }

  return lines.join('\n');
}

// ============================================================================
// STEP EXECUTION
// ============================================================================

/**
 * Execute a single plan step
 */
async function executeStep(
  step: PlanStep,
  options: ExecutorOptions,
  backups: FileBackup[],
): Promise<StepExecutionResult> {
  const startTime = Date.now();
  const filesModified: string[] = [];

  // Dry run - just return preview
  if (options.mode === 'dry-run') {
    return {
      step,
      success: true,
      filesModified: [],
      duration: Date.now() - startTime,
      verified: true,
      rolledBack: false,
    };
  }

  // Interactive mode - ask for confirmation
  if (options.mode === 'interactive' && options.onConfirm) {
    const preview = generatePreview(step);
    const confirmed = await options.onConfirm(step, preview);

    if (!confirmed) {
      step.status = 'skipped';
      return {
        step,
        success: true,
        filesModified: [],
        duration: Date.now() - startTime,
        verified: true,
        rolledBack: false,
      };
    }
  }

  // Notify progress
  options.onProgress?.(step, 'in_progress');
  step.status = 'in_progress';

  try {
    // Backup files first
    for (const file of step.files) {
      if (!backups.some((b) => b.path === file)) {
        backups.push(backupFile(file));
      }
    }

    // Convert to operation and apply
    const operation = stepToOperation(step);

    if (operation) {
      const result = applyFix(operation, {
        file: operation.file,
        line: operation.line ?? 0,
        message: step.description,
        category: 'agent',
        severity: 'warning',
      });

      if (!result.success) {
        step.status = 'failed';
        const errorMsg = result.error ?? 'Unknown error';
        options.onProgress?.(step, 'failed', errorMsg);

        return {
          step,
          success: false,
          error: errorMsg,
          filesModified: [],
          duration: Date.now() - startTime,
          verified: false,
          rolledBack: false,
        };
      }

      filesModified.push(operation.file);
    } else if (step.files.length > 0 && step.newCode) {
      // Handle full file replacement for complex actions
      for (const file of step.files) {
        if (fs.existsSync(file)) {
          fs.writeFileSync(file, step.newCode);
          filesModified.push(file);
        }
      }
    }

    // Verify if requested
    let verified = true;
    if (options.verifyEachStep && isTscAvailable(options.projectRoot)) {
      const tsResult = runTypeCheck(options.projectRoot);
      verified = tsResult.success;

      if (!verified) {
        // Rollback
        for (const file of step.files) {
          const backup = backups.find((b) => b.path === file);
          if (backup) {
            restoreFile(backup);
          }
        }

        step.status = 'rolled_back';
        options.onProgress?.(step, 'rolled_back', 'Verification failed');

        return {
          step,
          success: false,
          error: `Verification failed: ${tsResult.errorCount} TypeScript errors`,
          filesModified,
          duration: Date.now() - startTime,
          verified: false,
          rolledBack: true,
        };
      }
    }

    step.status = 'success';
    options.onProgress?.(step, 'success');

    return {
      step,
      success: true,
      filesModified,
      duration: Date.now() - startTime,
      verified,
      rolledBack: false,
    };
  } catch (error) {
    step.status = 'failed';
    const errorMessage = error instanceof Error ? error.message : String(error);
    options.onProgress?.(step, 'failed', errorMessage);

    return {
      step,
      success: false,
      error: errorMessage,
      filesModified,
      duration: Date.now() - startTime,
      verified: false,
      rolledBack: false,
    };
  }
}

// ============================================================================
// PLAN EXECUTION
// ============================================================================

/**
 * Execute an improvement plan
 */
export async function executePlan(
  plan: ImprovementPlan,
  options: ExecutorOptions,
): Promise<PlanExecutionResult> {
  const startTime = Date.now();
  const backups: FileBackup[] = [];
  const results: StepExecutionResult[] = [];

  let stepsExecuted = 0;
  let stepsSucceeded = 0;
  let stepsFailed = 0;
  let stepsSkipped = 0;

  // Sort steps by dependencies
  const sortedSteps = sortStepsByDependencies(plan.steps);

  try {
    for (const step of sortedSteps) {
      // Check dependencies
      if (step.dependsOn && step.dependsOn.length > 0) {
        const dependencyFailed = step.dependsOn.some((depNum) => {
          const depResult = results.find((r) => r.step.number === depNum);
          return depResult && !depResult.success;
        });

        if (dependencyFailed) {
          step.status = 'skipped';
          stepsSkipped++;
          results.push({
            step,
            success: false,
            error: 'Dependency failed',
            filesModified: [],
            duration: 0,
            verified: false,
            rolledBack: false,
          });
          continue;
        }
      }

      // Execute step
      const result = await executeStep(step, options, backups);
      results.push(result);
      stepsExecuted++;

      if (result.success) {
        if (result.step.status === 'skipped') {
          stepsSkipped++;
        } else {
          stepsSucceeded++;
        }
      } else {
        stepsFailed++;

        // Stop on failure if requested
        if (options.stopOnFailure) {
          // Rollback all previous changes
          for (const backup of [...backups].reverse()) {
            restoreFile(backup);
          }
          break;
        }
      }
    }

    // Final verification
    let verification: PlanExecutionResult['verification'];

    if (options.verifyAtEnd && options.mode !== 'dry-run') {
      verification = {
        typecheck: { success: true },
      };

      if (isTscAvailable(options.projectRoot)) {
        const tsResult = runTypeCheck(options.projectRoot);
        verification.typecheck = {
          success: tsResult.success,
          errors: tsResult.errorCount,
        };

        // Rollback all on verification failure
        if (!tsResult.success && options.stopOnFailure) {
          for (const backup of [...backups].reverse()) {
            restoreFile(backup);
          }

          return {
            plan,
            success: false,
            steps: results,
            stepsExecuted,
            stepsSucceeded,
            stepsFailed,
            stepsSkipped,
            duration: Date.now() - startTime,
            verification,
          };
        }
      }
    }

    const success = stepsFailed === 0;

    const executionResult: PlanExecutionResult = {
      plan,
      success,
      steps: results,
      stepsExecuted,
      stepsSucceeded,
      stepsFailed,
      stepsSkipped,
      duration: Date.now() - startTime,
    };

    if (verification) {
      executionResult.verification = verification;
    }

    return executionResult;
  } catch (_error) {
    // Unexpected error - rollback
    for (const backup of [...backups].reverse()) {
      restoreFile(backup);
    }

    return {
      plan,
      success: false,
      steps: results,
      stepsExecuted,
      stepsSucceeded,
      stepsFailed: stepsFailed + 1,
      stepsSkipped,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Sort steps by dependencies (topological sort)
 */
function sortStepsByDependencies(steps: PlanStep[]): PlanStep[] {
  const sorted: PlanStep[] = [];
  const visited = new Set<number>();
  const visiting = new Set<number>();

  const stepMap = new Map(steps.map((s) => [s.number, s]));

  function visit(step: PlanStep): void {
    if (visited.has(step.number)) return;
    if (visiting.has(step.number)) {
      // Circular dependency - just add it
      return;
    }

    visiting.add(step.number);

    // Visit dependencies first
    if (step.dependsOn) {
      for (const depNum of step.dependsOn) {
        const dep = stepMap.get(depNum);
        if (dep) {
          visit(dep);
        }
      }
    }

    visiting.delete(step.number);
    visited.add(step.number);
    sorted.push(step);
  }

  for (const step of steps) {
    visit(step);
  }

  return sorted;
}

// ============================================================================
// DRY RUN
// ============================================================================

/**
 * Preview plan execution without applying changes
 */
export function previewPlan(plan: ImprovementPlan): string {
  const lines: string[] = [];

  lines.push(`# ${plan.title}`);
  lines.push('');
  lines.push(plan.description);
  lines.push('');
  lines.push('## Summary');
  lines.push(`- Total steps: ${plan.summary.totalSteps}`);
  lines.push(`- Estimated effort: ${plan.summary.estimatedEffort}`);
  lines.push('');
  lines.push('## Steps');

  for (const step of plan.steps) {
    lines.push('');
    lines.push(generatePreview(step));
  }

  return lines.join('\n');
}
