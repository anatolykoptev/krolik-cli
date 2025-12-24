/**
 * @module lib/@git
 * @description Git and GitHub utilities
 */

// Git operations
export * from './git';

// GitHub CLI wrapper
export * from './github';

// Backup utilities
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
  isGitRepoForBackup,
  getCurrentBranchForBackup,
  type GitBackupResult,
  type RestoreResult,
} from './backup';
