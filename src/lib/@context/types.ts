/**
 * @module lib/@context/types
 * @description Types for file and project context
 */

/**
 * File type classification
 */
export type FileType =
  | 'component'
  | 'hook'
  | 'util'
  | 'api'
  | 'config'
  | 'test'
  | 'cli'
  | 'output'
  | 'schema'
  | 'unknown';

/**
 * File context for quality analysis and fixing
 */
export interface FileContext {
  /** Absolute path */
  path: string;
  /** Relative to project root */
  relativePath: string;
  /** Detected file type */
  type: FileType;
  /** Should skip lint checks */
  skipLint: boolean;
  /** Should skip console checks */
  skipConsole: boolean;
  /** Is test file */
  isTest: boolean;
  /** Is CLI file */
  isCli: boolean;
  /** Is config file */
  isConfig: boolean;
  /** Is output/logger file */
  isOutput: boolean;
}

/**
 * Options for building file context
 */
export interface FileContextOptions {
  /** Project root path */
  projectRoot?: string;
  /** Force specific file type */
  forceType?: FileType;
}
