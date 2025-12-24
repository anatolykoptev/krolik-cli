/**
 * @module lib
 * @description Core library exports
 *
 * Flat namespace structure optimized for AI navigation:
 * - @agents - Agent marketplace utilities
 * - @ast - AST utilities (centralized ts-morph)
 * - @context - File type detection, skip logic
 * - @discovery - Project root, schemas, routes
 * - @formatters - XML, JSON, Markdown, Text
 * - @fs - File system operations
 * - @git - Git and GitHub operations
 * - @log - Logging utilities
 * - @markdown - Markdown utilities (frontmatter)
 * - @patterns - Lint, hardcoded, complexity patterns
 * - @sanitize - Input sanitization and validation
 * - @shell - Shell execution
 * - @time - Timing utilities
 */

// AST utilities (centralized ts-morph)
export * from './@ast';

// Formatters (XML, JSON, Markdown, Text)
export * from './@formatters';

// Discovery (project root, schemas, routes)
export * from './@discovery';

// Patterns (lint, hardcoded, complexity) - single source of truth
export * from './@patterns';

// Context (file type detection, skip logic)
export * from './@context';

// Agents marketplace utilities
export * from './@agents';

// Markdown utilities (frontmatter parsing)
export * from './@markdown';

// Input sanitization and validation
export * from './@sanitize';

// Logger
export { createLogger, logger } from './@log/logger';

// Shell execution
export { exec, tryExec, execLines, commandExists, getPackageManager } from './@shell/shell';
export type { ShellOptions, ShellResult } from './@shell/shell';

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
} from './@fs/fs';
export type { FindFilesOptions } from './@fs/fs';

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
} from './@git/git';
export type { GitStatus, GitCommit, GitAheadBehind } from './@git/git';

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
} from './@git/github';
export type { GitHubIssue, GitHubPR } from './@git/github';

// Timing utilities
export { measureTime, measureTimeAsync, formatDuration } from './@time/timing';

// Git backup utilities
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
} from './@git/backup';
export type { GitBackupResult, RestoreResult } from './@git/backup';

// Documentation injection
export {
  syncClaudeMd,
  needsSync,
  getSyncStatus,
  DOCS_VERSION,
  generateKrolikDocs,
} from './@docs';
export type { SyncResult, SyncOptions } from './@docs';
