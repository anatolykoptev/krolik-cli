/**
 * @module commands/context/helpers/files
 * @description File search utilities
 */

import { scanDirectorySync } from '@/lib/@core/fs';

/**
 * Find files matching patterns in a directory (recursive)
 */
export function findFilesMatching(dir: string, patterns: string[], ext: string): string[] {
  return scanDirectorySync(dir, {
    patterns,
    extensions: [ext],
  });
}
