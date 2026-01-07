/**
 * @module lib/@core/krolik-paths
 * @description Centralized .krolik directory management
 *
 * Provides utilities for:
 * - Project-scoped .krolik directory (project root)
 * - User-scoped .krolik directory (~/.krolik for global storage)
 * - Safe file operations with automatic project root detection
 *
 * Architecture:
 * - Uses @discovery/findProjectRoot as single source of truth
 * - Auto-detects project root when not explicitly provided
 * - Validates paths before creating .krolik directories
 * - Supports both project and user scopes
 */

import { homedir } from 'node:os';
import * as path from 'node:path';
import { findProjectRoot } from '../../@discovery/project';
import { ensureDir, exists, isDirectory, writeFile } from '../fs';
import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export type KrolikScope = 'project' | 'user';

export interface ResolveOptions {
  /** Starting directory for project root search (default: process.cwd()) */
  startDir?: string;
  /** Explicit project root override (skips auto-detection) */
  projectRoot?: string;
  /** Whether to validate the resolved path (default: true) */
  validate?: boolean;
}

export interface SaveOptions extends ResolveOptions {
  /** Scope: 'project' for project root, 'user' for ~/.krolik (default: 'project') */
  scope?: KrolikScope;
}

// ============================================================================
// PATH CACHE (Performance optimization)
// ============================================================================

/**
 * User .krolik directory cache
 * Cached permanently since homedir() rarely changes
 */
let cachedUserKrolikDir: string | null = null;

/**
 * Clear cached paths (useful for testing)
 */
export function clearKrolikPathCache(): void {
  cachedUserKrolikDir = null;
}

// ============================================================================
// PROJECT ROOT RESOLUTION
// ============================================================================

/**
 * Resolve project root directory
 *
 * Uses @discovery/findProjectRoot as single source of truth.
 * Delegates caching to @discovery layer (5-second TTL with mtime checks).
 *
 * @param options - Resolution options
 * @returns Absolute path to project root
 * @throws Error if project root cannot be found and validate=true
 */
export function resolveProjectRoot(options: ResolveOptions = {}): string {
  const { startDir, projectRoot: explicit, validate = true } = options;

  // Use explicit override if provided
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (validate && !isValidProjectRoot(resolved)) {
      throw new Error(
        `Invalid project root: ${resolved} ` + `(not a directory or missing package.json/.git)`,
      );
    }
    return resolved;
  }

  // Auto-detect using @discovery (has built-in caching)
  const detected = findProjectRoot(startDir);

  // Only validate if findProjectRoot returned fallback (startDir)
  // If it found package.json/.git, validation is redundant
  if (validate && detected === (startDir || process.cwd())) {
    // Fallback was returned, verify it's actually valid
    if (!isValidProjectRoot(detected)) {
      throw new Error(
        `Project root not found from ${startDir || process.cwd()}. ` +
          `No package.json or .git found in any parent directory.`,
      );
    }
  }

  return detected;
}

/**
 * Validate that a directory is a valid project root
 *
 * Checks:
 * 1. Path exists and is a directory
 * 2. Contains package.json OR .git
 */
function isValidProjectRoot(dir: string): boolean {
  if (!exists(dir) || !isDirectory(dir)) {
    return false;
  }
  return exists(path.join(dir, 'package.json')) || exists(path.join(dir, '.git'));
}

// ============================================================================
// .KROLIK DIRECTORY PATHS
// ============================================================================

/**
 * Get project .krolik directory path
 *
 * Returns: {projectRoot}/.krolik
 *
 * @param options - Resolution options
 * @returns Absolute path to project .krolik directory
 */
export function getProjectKrolikDir(options: ResolveOptions = {}): string {
  const projectRoot = resolveProjectRoot(options);
  return path.join(projectRoot, '.krolik');
}

/**
 * Get user .krolik directory path
 *
 * Returns: ~/.krolik (for global storage like memory, docs cache, agent plugins)
 *
 * @returns Absolute path to user .krolik directory
 */
export function getUserKrolikDir(): string {
  if (cachedUserKrolikDir) {
    return cachedUserKrolikDir;
  }

  const userDir = path.join(homedir(), '.krolik');
  cachedUserKrolikDir = userDir;
  return userDir;
}

/**
 * Get .krolik directory path by scope
 *
 * @param scope - 'project' or 'user'
 * @param options - Resolution options (only used for 'project' scope)
 * @returns Absolute path to .krolik directory
 */
export function getKrolikDir(scope: KrolikScope, options: ResolveOptions = {}): string {
  return scope === 'project' ? getProjectKrolikDir(options) : getUserKrolikDir();
}

// ============================================================================
// DIRECTORY CREATION
// ============================================================================

/**
 * Ensure .krolik directory exists
 *
 * Creates the directory if it doesn't exist.
 *
 * @param scope - 'project' or 'user'
 * @param options - Resolution options (only used for 'project' scope)
 * @returns Absolute path to .krolik directory
 * @throws Error if directory creation fails
 */
export function ensureKrolikDir(scope: KrolikScope, options: ResolveOptions = {}): string {
  const krolikDir = getKrolikDir(scope, options);

  if (!ensureDir(krolikDir)) {
    throw new Error(`Failed to create .krolik directory: ${krolikDir}`);
  }

  return krolikDir;
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

/**
 * Save file to .krolik directory
 *
 * Auto-detects project root and creates .krolik directory if needed.
 *
 * **Error Handling:**
 * - Errors are logged but NOT thrown
 * - Returns `false` on failure
 * - Use for fire-and-forget caching (context, schema, routes)
 * - Check return value if save is critical
 *
 * @param filename - Filename to save (e.g., 'CONTEXT.xml', 'SCHEMA.xml')
 * @param content - File content
 * @param options - Save options
 * @returns true if saved successfully, false on any error
 *
 * @example
 * // Save to project .krolik (auto-detected)
 * saveToKrolik('CONTEXT.xml', xmlContent);
 *
 * // Save to user ~/.krolik
 * saveToKrolik('memories.db', dbContent, { scope: 'user' });
 *
 * // Save with explicit project root
 * saveToKrolik('SCHEMA.xml', schemaXml, { projectRoot: '/path/to/project' });
 *
 * // Check if save succeeded (for critical files)
 * if (!saveToKrolik('critical.xml', data)) {
 *   throw new Error('Failed to save critical data');
 * }
 */
export function saveToKrolik(
  filename: string,
  content: string,
  options: SaveOptions = {},
): boolean {
  const { scope = 'project', ...resolveOpts } = options;

  try {
    const krolikDir = ensureKrolikDir(scope, resolveOpts);
    const filePath = path.join(krolikDir, filename);
    return writeFile(filePath, content);
  } catch (error) {
    // Log error but don't throw - allows graceful degradation
    logger.error(`Failed to save to .krolik/${filename}: ${error}`);
    return false;
  }
}

/**
 * Get full path to file in .krolik directory
 *
 * Does NOT create the directory or file.
 *
 * @param filename - Filename
 * @param scope - 'project' or 'user' (default: 'project')
 * @param options - Resolution options (only used for 'project' scope)
 * @returns Absolute path to file
 */
export function getKrolikFilePath(
  filename: string,
  scope: KrolikScope = 'project',
  options: ResolveOptions = {},
): string {
  const krolikDir = getKrolikDir(scope, options);
  return path.join(krolikDir, filename);
}
