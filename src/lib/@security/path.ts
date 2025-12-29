/**
 * @module lib/@security/path
 * @description Path validation and security utilities
 *
 * Prevents path traversal attacks by validating user-provided paths
 * against project root. Used by fix, refactor commands.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Result of path validation
 */
export interface PathValidationResult {
  valid: boolean;
  resolved: string;
  relative: string;
  error?: string;
}

/**
 * Normalize path to always be relative (strip absolute path components)
 *
 * Handles cases where a path accidentally becomes absolute (e.g., from
 * concatenation or user input). Extracts the relative portion.
 *
 * @param targetPath - Path to normalize
 * @param basePath - Base path to make relative to
 * @returns Relative path
 *
 * @example
 * ```ts
 * normalizeToRelative('/project/src/lib/git.ts', '/project/src/lib')
 * // Returns: 'git.ts'
 *
 * normalizeToRelative('@git/backup.ts', '/project/src/lib')
 * // Returns: '@git/backup.ts' (already relative)
 * ```
 */
export function normalizeToRelative(targetPath: string, basePath: string): string {
  // If it's an absolute path that starts with basePath, make it relative
  if (path.isAbsolute(targetPath)) {
    if (targetPath.startsWith(basePath)) {
      return path.relative(basePath, targetPath);
    }
    // If it's an absolute path not under basePath, extract just the basename parts
    // This handles the case where action.source is accidentally an absolute path
    const parts = targetPath.split(path.sep);
    // Find where 'lib' or 'src' appears and take everything after
    const libIndex = parts.lastIndexOf('lib');
    if (libIndex !== -1) {
      return parts.slice(libIndex + 1).join(path.sep);
    }
    const srcIndex = parts.lastIndexOf('src');
    if (srcIndex !== -1) {
      return parts.slice(srcIndex + 1).join(path.sep);
    }
    // Fallback: just use the last component
    return path.basename(targetPath);
  }
  return targetPath;
}

/**
 * Validate that a path is within project root (prevents path traversal)
 *
 * Features:
 * - Resolves to absolute path
 * - Checks for path traversal (../)
 * - Optionally checks for symlinks
 * - Sanitizes input (removes null bytes, etc.)
 *
 * @param projectRoot - The root directory of the project
 * @param targetPath - User-provided path to validate
 * @param options - Validation options
 * @returns Validation result with resolved path or error
 *
 * @example
 * ```ts
 * const result = validatePathWithinProject('/project', '../etc/passwd');
 * if (!result.valid) {
 *   console.error(result.error); // "Path escapes project root"
 * }
 * ```
 */
export function validatePathWithinProject(
  projectRoot: string,
  targetPath: string,
  options: { checkSymlinks?: boolean } = {},
): PathValidationResult {
  // Sanitize input
  const sanitized = targetPath
    .replace(/\0/g, '') // Remove null bytes
    .trim();

  // Reject suspicious patterns
  if (/[\0<>:"|?*]/.test(sanitized)) {
    return {
      valid: false,
      resolved: '',
      relative: '',
      error: `Invalid path characters: ${targetPath}`,
    };
  }

  // Resolve both paths to absolute
  const resolvedRoot = path.resolve(projectRoot);
  const resolved = path.resolve(projectRoot, sanitized);

  // Check if resolved path is within project root
  const relative = path.relative(resolvedRoot, resolved);

  // Path escapes if it starts with '..' or is absolute
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return {
      valid: false,
      resolved,
      relative,
      error: `Path "${targetPath}" escapes project root`,
    };
  }

  // Check for symlinks (security risk) if requested
  if (options.checkSymlinks !== false) {
    try {
      const stats = fs.lstatSync(resolved);
      if (stats.isSymbolicLink()) {
        return {
          valid: false,
          resolved,
          relative,
          error: `Symlinks are not allowed: "${targetPath}"`,
        };
      }
    } catch {
      // File doesn't exist yet, that's ok
    }
  }

  return { valid: true, resolved, relative };
}

/**
 * Validate and resolve a path, throwing on invalid paths
 *
 * This is a stricter version that throws instead of returning an error object.
 *
 * @param basePath - Base directory path
 * @param targetPath - Path to validate
 * @returns Resolved absolute path
 * @throws Error if path is invalid or attempts traversal
 */
export function validatePathOrThrow(basePath: string, targetPath: string): string {
  const result = validatePathWithinProject(basePath, targetPath);
  if (!result.valid) {
    throw new Error(result.error ?? 'Path validation failed');
  }
  return result.resolved;
}

/**
 * Check if a path is safe (doesn't escape base directory)
 *
 * Quick check without full validation - use for filtering paths.
 *
 * @param basePath - Base directory path
 * @param targetPath - Path to check
 * @returns true if path is safe
 */
export function isPathSafe(basePath: string, targetPath: string): boolean {
  const result = validatePathWithinProject(basePath, targetPath, { checkSymlinks: false });
  return result.valid;
}
