/**
 * @module commands/fix/git-backup
 * @description Re-exports git backup utilities from shared lib
 *
 * @deprecated Import directly from '../../lib' instead
 */

// Re-export everything from shared module for backwards compatibility
export {
  createBackupBranch,
  deleteBackupBranch,
  restoreFromBackup,
  fullRestore,
  cleanupBackup,
  hasUncommittedChanges,
  stashChanges,
  applyStash,
  popStash,
  dropStash,
  isGitRepoForBackup as isGitRepo,
  getCurrentBranchForBackup as getCurrentBranch,
  type GitBackupResult,
  type RestoreResult,
} from '../../lib';
