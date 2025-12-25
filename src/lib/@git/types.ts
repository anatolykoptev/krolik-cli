/**
 * @module lib/@git/types
 * @description Shared Git type definitions
 */

/**
 * Git status information
 */
export interface GitStatus {
  /** Files with modifications */
  modified: string[];
  /** Untracked files */
  untracked: string[];
  /** Staged files */
  staged: string[];
  /** Has any changes */
  hasChanges: boolean;
}

/**
 * Commit information
 */
export interface GitCommit {
  hash: string;
  message: string;
  author?: string;
  date?: string;
}

/**
 * Ahead/behind remote status
 */
export interface GitAheadBehind {
  ahead: number;
  behind: number;
}
