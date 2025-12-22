/**
 * @module lib
 * @description Core library exports
 */

// Logger
export { createLogger, logger } from './logger';

// Shell execution
export { exec, tryExec, execLines, commandExists, getPackageManager } from './shell';
export type { ShellOptions, ShellResult } from './shell';

// File system
export {
  exists,
  isDirectory,
  isFile,
  readFile,
  writeFile,
  readJson,
  writeJson,
  ensureDir,
  relativePath,
  findFiles,
  getSubdirectories,
  listFiles,
} from './fs';
export type { FindFilesOptions } from './fs';

// Git
export {
  isGitRepo,
  getCurrentBranch,
  getDefaultBranch,
  getStatus,
  getRecentCommits,
  getAheadBehind,
  getDiffStats,
  getFileDiff,
  getStagedDiff,
  getDiff,
  getStagedFiles,
  getChangedFiles,
  getChangedFilesBetween,
  getMergeBase,
  refExists,
} from './git';
export type { GitStatus, GitCommit, GitAheadBehind } from './git';

// GitHub
export {
  isGhAvailable,
  isGhAuthenticated,
  getRepoInfo,
  getIssue,
  getPR,
  getCurrentPR,
  listIssues,
  listPRs,
} from './github';
export type { GitHubIssue, GitHubPR } from './github';
