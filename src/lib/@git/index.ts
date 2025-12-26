/**
 * @module lib/@git
 * @description Git and GitHub utilities
 */

// Backup utilities
export {
  applyStash,
  type CommitPushResult,
  cleanupBackup,
  commitAndPushChanges,
  createBackupBranch,
  deleteBackupBranch,
  dropStash,
  fullRestore,
  type GitBackupResult,
  getCurrentBranchForBackup,
  hasUncommittedChanges,
  isGitRepoForBackup,
  popStash,
  type RestoreResult,
  restoreFromBackup,
  stashChanges,
} from './backup';
// GitHub CLI wrapper
export * from './github';
// Re-export GitInfo type from local
export type { GitInfo } from './local';
// Local git operations (project repository)
export * from './local';
// Remote git operations (external repositories)
export * from './remote';
// Shared type definitions
export type { GitAheadBehind, GitCommit, GitStatus } from './types';
