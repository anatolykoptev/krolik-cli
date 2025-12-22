/**
 * @module commands/fix/git-backup
 * @description Git backup before applying fixes
 *
 * Creates a backup branch before applying fixes:
 * 1. Check if git repo
 * 2. Check for uncommitted changes
 * 3. Create backup branch
 * 4. Commit current state (if needed)
 */

import { execSync } from "node:child_process";

export interface GitBackupResult {
  success: boolean;
  branchName?: string;
  hadUncommittedChanges: boolean;
  error?: string;
}

const SLICE_ARG1_VALUE = 15;

/**
 * Check if directory is a git repository
 */
export function isGitRepo(cwd: string): boolean {
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
export function getCurrentBranch(cwd: string): string | null {
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
function generateBackupBranchName(): string {
  const now = new Date();
  const timestamp = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, SLICE_ARG1_VALUE);
  return `backup/pre-fix-${timestamp}`;
}

/**
 * Create backup branch before fixes
 *
 * Simple strategy:
 * - Create a branch from HEAD to mark the pre-fix commit state
 * - Does NOT commit uncommitted changes (they stay in working directory)
 * - If fix fails, user can restore committed state with: git checkout <backup> -- .
 */
export function createBackupBranch(cwd: string): GitBackupResult {
  // Check if git repo
  if (!isGitRepo(cwd)) {
    return {
      success: false,
      hadUncommittedChanges: false,
      error: "Not a git repository",
    };
  }

  const branchName = generateBackupBranchName();
  const hadChanges = hasUncommittedChanges(cwd);

  try {
    // Create backup branch from current HEAD (doesn't switch branches)
    execSync(`git branch ${branchName}`, {
      cwd,
      stdio: "pipe",
    });

    return {
      success: true,
      branchName,
      hadUncommittedChanges: hadChanges,
    };
  } catch (error) {
    return {
      success: false,
      hadUncommittedChanges: hadChanges,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Delete backup branch (after successful fix)
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
 * Restore from backup branch (after failed fix)
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
