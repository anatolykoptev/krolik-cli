/**
 * @module commands/refactor/paths/types
 * @description Type definitions for path resolution
 */

import type { MonorepoPackage } from '../../../config';

/**
 * Resolved paths for refactor analysis
 */
export interface ResolvedPathsWithPackage {
  /** Absolute target path for analysis (primary path, usually lib) */
  targetPath: string;
  /** All target paths for analysis (lib, components, app, etc.) */
  targetPaths: string[];
  /** Absolute path to lib directory */
  libPath: string;
  /** Relative path from project root (primary) */
  relativePath: string;
  /** All relative paths from project root */
  relativePaths: string[];
  /** Package info for monorepo setups */
  packageInfo?: MonorepoPackage;
}
