/**
 * @module lib/@git/backup
 * @description Git backup utilities for safe operations
 *
 * Creates a backup before applying destructive operations:
 * 1. Check if git repo
 * 2. Check for uncommitted changes
 * 3. Stash uncommitted changes
 * 4. Create backup branch
 * 5. Apply stash to restore working directory
 *
 * Used by: fix, refactor commands
 */

import { execSync } from "node:child_process";

export interface GitBackupResult {
  success: boolean;
  branchName?: string | undefined;
  hadUncommittedChanges: boolean;
  /** Stash message for uncommitted changes (if any) */
  stashMessage?: string | undefined;
  error?: string | undefined;
}

export interface RestoreResult {
  success: boolean;
  restoredBranch: boolean;
  restoredStash: boolean;
  error?: string | undefined;
}

const SLICE_ARG1_VALUE = 15;

/**
 * Check if directory is a git repository
 */
export function isGitRepoForBackup(cwd: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if there are uncommitted changes
 */
export function hasUncommittedChanges(cwd: string): boolean {
  try {
    const status = execSync("git status --porcelain", {
      cwd,
      encoding: "utf-8",
    });
    return status.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get current branch name
 */
export function getCurrentBranchForBackup(cwd: string): string | null {
  try {
    return execSync("git branch --show-current", {
      cwd,
      encoding: "utf-8",
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Generate backup branch name
 */
function generateBackupBranchName(prefix: string = "fix"): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, SLICE_ARG1_VALUE);
  return `backup/pre-${prefix}-${timestamp}`;
}

/**
 * Stash uncommitted changes with a descriptive message
 * Includes untracked files to ensure new files are also saved
 */
export function stashChanges(cwd: string, message: string): boolean {
  try {
    // Use --include-untracked to also save new files that aren't committed yet
    execSync(`git stash push --include-untracked -m "${message}"`, {
      cwd,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply the most recent stash (keeps stash in list as backup)
 */
export function applyStash(cwd: string): boolean {
  try {
    execSync("git stash apply", {
      cwd,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pop the most recent stash (removes from list)
 */
export function popStash(cwd: string): boolean {
  try {
    execSync("git stash pop", {
      cwd,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Drop the most recent stash
 */
export function dropStash(cwd: string): boolean {
  try {
    execSync("git stash drop", {
      cwd,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create backup branch before destructive operations
 *
 * Strategy:
 * 1. If uncommitted changes exist → stash them (stays in stash list as backup!)
 * 2. Create a branch from HEAD to mark the pre-operation commit state
 * 3. Apply stash (keeps copy in stash list) to restore working directory
 * 4. If operation fails, user can restore with:
 *    - git checkout <backup> -- .  (restore committed state)
 *    - git stash apply             (restore uncommitted changes)
 *
 * @param cwd - Working directory
 * @param prefix - Prefix for backup branch name (default: "fix")
 */
export function createBackupBranch(cwd: string, prefix: string = "fix"): GitBackupResult {
  // Check if git repo
  if (!isGitRepoForBackup(cwd)) {
    return {
      success: false,
      hadUncommittedChanges: false,
      error: "Not a git repository",
    };
  }

  const branchName = generateBackupBranchName(prefix);
  const hadChanges = hasUncommittedChanges(cwd);
  const stashMessage = hadChanges ? `krolik-backup-${branchName}` : undefined;

  try {
    // Stash uncommitted changes if any (stays in stash list as backup)
    if (hadChanges && stashMessage) {
      stashChanges(cwd, stashMessage);
    }

    // Create backup branch from current HEAD (doesn't switch branches)
    execSync(`git branch ${branchName}`, {
      cwd,
      stdio: "pipe",
    });

    // Apply stash to restore working directory (keeps stash in list as backup!)
    if (hadChanges) {
      applyStash(cwd);
    }

    return {
      success: true,
      branchName,
      hadUncommittedChanges: hadChanges,
      stashMessage,
    };
  } catch (error) {
    // Try to restore stash if something failed
    if (hadChanges) {
      applyStash(cwd);
    }

    return {
      success: false,
      hadUncommittedChanges: hadChanges,
      stashMessage,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Delete backup branch (after successful operation)
 */
export function deleteBackupBranch(cwd: string, branchName: string): boolean {
  try {
    execSync(`git branch -D ${branchName}`, {
      cwd,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Restore from backup branch (after failed operation)
 */
export function restoreFromBackup(cwd: string, branchName: string): boolean {
  try {
    // Reset to backup branch state
    execSync(`git checkout ${branchName} -- .`, {
      cwd,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Full restore: both branch state and stashed changes
 */
export function fullRestore(
  cwd: string,
  backupResult: GitBackupResult
): RestoreResult {
  let restoredBranch = false;
  let restoredStash = false;
  let error: string | undefined;

  // Restore from backup branch if it exists
  if (backupResult.branchName) {
    restoredBranch = restoreFromBackup(cwd, backupResult.branchName);
    if (!restoredBranch) {
      error = `Failed to restore from branch ${backupResult.branchName}`;
    }
  }

  // Apply stash if there were uncommitted changes
  if (backupResult.hadUncommittedChanges) {
    restoredStash = applyStash(cwd);
    if (!restoredStash && !error) {
      error = "Failed to restore stashed changes";
    }
  }

  return {
    success: restoredBranch || !backupResult.branchName,
    restoredBranch,
    restoredStash,
    error,
  };
}

/**
 * Cleanup after successful operation
 * - Delete backup branch
 * - Drop stash (optional, default: keep for safety)
 */
export function cleanupBackup(
  cwd: string,
  backupResult: GitBackupResult,
  dropStashAfter: boolean = false
): boolean {
  let success = true;

  // Delete backup branch
  if (backupResult.branchName) {
    success = deleteBackupBranch(cwd, backupResult.branchName) && success;
  }

  // Optionally drop stash
  if (dropStashAfter && backupResult.hadUncommittedChanges) {
    success = dropStash(cwd) && success;
  }

  return success;
}
