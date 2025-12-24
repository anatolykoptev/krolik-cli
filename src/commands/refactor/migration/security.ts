/**
 * @module commands/refactor/migration/security
 * @description Security utilities for file operations
 *
 * Provides:
 * - Path validation to prevent traversal attacks
 * - Safe file/directory deletion
 * - Backup creation before destructive operations
 */

import * as fs from 'node:fs';
import * as path from 'path';
import { normalizeToRelative } from '../../../lib';

// ============================================================================
// PATH VALIDATION
// ============================================================================

/**
 * Validate and sanitize a path to prevent traversal attacks
 * @throws Error if path is invalid or attempts traversal
 */
export function validatePath(basePath: string, targetPath: string): string {
  // First normalize to relative path
  const relativePath = normalizeToRelative(targetPath, basePath);

  // Sanitize input
  const sanitized = relativePath
    .replace(/\0/g, '') // Remove null bytes
    .trim();

  // Reject suspicious patterns
  if (/[\0<>:"|?*]/.test(sanitized)) {
    throw new Error(`Invalid path characters: ${targetPath}`);
  }

  const normalized = path.normalize(sanitized);
  const fullPath = path.join(basePath, normalized);
  const resolvedPath = path.resolve(fullPath);
  const resolvedBase = path.resolve(basePath);

  // Ensure the resolved path is within the base directory
  if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
    throw new Error(`Path traversal attempt detected: ${targetPath}`);
  }

  return resolvedPath;
}

// ============================================================================
// SAFE FILE OPERATIONS
// ============================================================================

/**
 * Delete a file or directory with safety checks
 */
export function safeDelete(filePath: string): boolean {
  try {
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      fs.rmSync(filePath, { recursive: true });
    } else {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a backup of a file/directory
 * @returns Backup path or null if failed
 */
export function createBackup(filePath: string): string | null {
  try {
    const backupPath = `${filePath}.bak.${Date.now()}`;
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      fs.cpSync(filePath, backupPath, { recursive: true });
    } else {
      fs.copyFileSync(filePath, backupPath);
    }
    return backupPath;
  } catch {
    return null;
  }
}

/**
 * Restore from backup
 */
export function restoreFromBackup(backupPath: string, originalPath: string): boolean {
  try {
    const stats = fs.statSync(backupPath);
    if (stats.isDirectory()) {
      // Remove current version if exists
      if (fs.existsSync(originalPath)) {
        fs.rmSync(originalPath, { recursive: true });
      }
      fs.cpSync(backupPath, originalPath, { recursive: true });
    } else {
      fs.copyFileSync(backupPath, originalPath);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove backup after successful operation
 */
export function removeBackup(backupPath: string): boolean {
  return safeDelete(backupPath);
}
