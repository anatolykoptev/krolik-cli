/**
 * @module lib/@git/remote
 * @description Git operations for external/remote repositories
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Version info from git
 */
export interface VersionInfo {
  version: string;
  date: string;
}

/**
 * Check if git is available
 */
export function isGitAvailable(): boolean {
  try {
    const result = spawnSync('git', ['--version'], { stdio: 'pipe' });
    return result.status === 0;
  } catch {
    return false;
  }
}

/**
 * Get git version info for a repository
 */
export function getGitVersion(repoPath: string): VersionInfo | null {
  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    return null;
  }

  try {
    const hashResult = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: repoPath,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    const dateResult = spawnSync('git', ['log', '-1', '--format=%ci'], {
      cwd: repoPath,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    if (hashResult.status === 0 && dateResult.status === 0) {
      return {
        version: hashResult.stdout.trim(),
        date: dateResult.stdout.trim(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clone a repository
 */
export function cloneRepo(
  url: string,
  targetDir: string,
  depth = 1,
): { success: boolean; error?: string } {
  try {
    const result = spawnSync('git', ['clone', '--depth', String(depth), url, targetDir], {
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 60000,
    });

    if (result.status !== 0) {
      return { success: false, error: result.stderr || 'Clone failed' };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Pull latest changes from remote
 */
export function pullRepo(repoPath: string): { success: boolean; updated: boolean; error?: string } {
  try {
    spawnSync('git', ['fetch', 'origin'], {
      cwd: repoPath,
      stdio: 'pipe',
      timeout: 30000,
    });

    const statusResult = spawnSync('git', ['status', '-uno'], {
      cwd: repoPath,
      stdio: 'pipe',
      encoding: 'utf8',
    });

    if (!statusResult.stdout?.includes('behind')) {
      return { success: true, updated: false };
    }

    const pullResult = spawnSync('git', ['pull', '--ff-only'], {
      cwd: repoPath,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 60000,
    });

    if (pullResult.status !== 0) {
      return { success: false, updated: false, error: pullResult.stderr || 'Pull failed' };
    }

    return { success: true, updated: true };
  } catch (error) {
    return {
      success: false,
      updated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
