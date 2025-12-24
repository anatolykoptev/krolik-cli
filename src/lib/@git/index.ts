/**
 * @module lib/@git
 * @description Git and GitHub utilities
 */

// Local git operations (project repository)
export * from './local';

// Remote git operations (external repositories)
export * from './remote';

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
