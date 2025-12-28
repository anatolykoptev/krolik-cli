/**
 * @module commands/refactor/paths/types
 * @description Type definitions for path resolution
 */

import type { MonorepoPackage } from '../../../config';

/**
 * Resolved paths for refactor analysis
 */
export interface ResolvedPathsWithPackage {
  /** Absolute target path for analysis */
  targetPath: string;
  /** Absolute path to lib directory */
  libPath: string;
  /** Relative path from project root */
  relativePath: string;
  /** Package info for monorepo setups */
  packageInfo?: MonorepoPackage;
}
