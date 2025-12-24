/**
 * @module commands/fix/git-backup
 * @description Re-exports git backup utilities from shared lib
 *
 * @deprecated Import directly from '../../lib' instead
 */

// Re-export everything from shared module for backwards compatibility
export {
  applyStash,
  cleanupBackup,
  createBackupBranch,
  deleteBackupBranch,
  dropStash,
  fullRestore,
  type GitBackupResult,
  getCurrentBranchForBackup as getCurrentBranch,
  hasUncommittedChanges,
  isGitRepoForBackup as isGitRepo,
  popStash,
  type RestoreResult,
  restoreFromBackup,
  stashChanges,
} from '../../lib';
