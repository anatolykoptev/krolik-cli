/**
 * @module lib/@docs/inject
 * @description Automatic CLAUDE.md documentation injection
 *
 * Ensures AI assistants always have up-to-date krolik documentation
 * by automatically syncing the krolik section in CLAUDE.md
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOCS_VERSION,
  KROLIK_SECTION_START,
  KROLIK_SECTION_END,
  generateKrolikDocs,
  generateMinimalClaudeMd,
} from './template';

/**
 * Result of sync operation
 */
export interface SyncResult {
  action: 'created' | 'updated' | 'skipped';
  path: string;
  version: string;
  previousVersion?: string;
}

/**
 * Options for sync operation
 */
export interface SyncOptions {
  /** Force update even if versions match */
  force?: boolean;
  /** Dry run - don't write changes */
  dryRun?: boolean;
  /** Suppress output */
  silent?: boolean;
}

/**
 * Extract version from existing krolik section
 */
function extractVersion(content: string): string | null {
  const versionMatch = content.match(/<!-- version: ([\d.]+)/);
  return versionMatch?.[1] ?? null;
}

/**
 * Check if krolik section exists in content
 */
function hasKrolikSection(content: string): boolean {
  return content.includes(KROLIK_SECTION_START) && content.includes(KROLIK_SECTION_END);
}

/**
 * Replace krolik section in content
 */
function replaceKrolikSection(content: string, newSection: string): string {
  const startIndex = content.indexOf(KROLIK_SECTION_START);
  const endIndex = content.indexOf(KROLIK_SECTION_END) + KROLIK_SECTION_END.length;

  if (startIndex === -1 || endIndex === -1) {
    // Section markers not found, append at end
    return `${content.trim()}\n\n---\n\n${newSection}\n`;
  }

  const before = content.slice(0, startIndex);
  const after = content.slice(endIndex);

  return `${before}${newSection}${after}`;
}

/**
 * Find the best place to insert krolik section
 * Looks for common section headers to insert after
 */
function findInsertPosition(content: string): number {
  // Try to find "Quick Commands" or similar sections to insert before
  const patterns = [
    /^## Quick Commands/m,
    /^## Commands/m,
    /^## Git & GitHub/m,
    /^## Project Structure/m,
    /^---\s*$/m, // First horizontal rule
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.index !== undefined) {
      // Insert before this section
      return match.index;
    }
  }

  // Default: append at end
  return content.length;
}

/**
 * Insert krolik section at appropriate position
 */
function insertKrolikSection(content: string, newSection: string): string {
  const position = findInsertPosition(content);

  if (position === content.length) {
    // Append at end
    return `${content.trim()}\n\n---\n\n${newSection}\n`;
  }

  const before = content.slice(0, position);
  const after = content.slice(position);

  return `${before.trim()}\n\n${newSection}\n\n---\n\n${after.trim()}\n`;
}

/**
 * Sync krolik documentation to CLAUDE.md
 *
 * @param projectRoot - Project root directory
 * @param options - Sync options
 * @returns Sync result
 */
export function syncClaudeMd(
  projectRoot: string,
  options: SyncOptions = {}
): SyncResult {
  const { force = false, dryRun = false } = options;

  const claudeMdPath = join(projectRoot, 'CLAUDE.md');
  const newSection = generateKrolikDocs();

  // Case 1: CLAUDE.md doesn't exist
  if (!existsSync(claudeMdPath)) {
    // Try to get project name from package.json
    let projectName = 'Project';
    const packageJsonPath = join(projectRoot, 'package.json');
    if (existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
        projectName = pkg.name || 'Project';
      } catch {
        // Ignore parse errors
      }
    }

    const newContent = generateMinimalClaudeMd(projectName);

    if (!dryRun) {
      writeFileSync(claudeMdPath, newContent, 'utf-8');
    }

    return {
      action: 'created',
      path: claudeMdPath,
      version: DOCS_VERSION,
    };
  }

  // Case 2: CLAUDE.md exists
  const existingContent = readFileSync(claudeMdPath, 'utf-8');

  if (hasKrolikSection(existingContent)) {
    // Section exists, check version
    const existingVersion = extractVersion(existingContent);

    if (existingVersion === DOCS_VERSION && !force) {
      return {
        action: 'skipped',
        path: claudeMdPath,
        version: DOCS_VERSION,
        previousVersion: existingVersion ?? undefined,
      };
    }

    // Update section
    const newContent = replaceKrolikSection(existingContent, newSection);

    if (!dryRun) {
      writeFileSync(claudeMdPath, newContent, 'utf-8');
    }

    return {
      action: 'updated' as const,
      path: claudeMdPath,
      version: DOCS_VERSION,
      ...(existingVersion ? { previousVersion: existingVersion } : {}),
    };
  }

  // Case 3: CLAUDE.md exists but no krolik section
  const newContent = insertKrolikSection(existingContent, newSection);

  if (!dryRun) {
    writeFileSync(claudeMdPath, newContent, 'utf-8');
  }

  return {
    action: 'updated',
    path: claudeMdPath,
    version: DOCS_VERSION,
  };
}

/**
 * Check if CLAUDE.md needs sync
 */
export function needsSync(projectRoot: string): boolean {
  const claudeMdPath = join(projectRoot, 'CLAUDE.md');

  if (!existsSync(claudeMdPath)) {
    return true;
  }

  const content = readFileSync(claudeMdPath, 'utf-8');

  if (!hasKrolikSection(content)) {
    return true;
  }

  const existingVersion = extractVersion(content);
  return existingVersion !== DOCS_VERSION;
}

/**
 * Get current sync status
 */
export function getSyncStatus(projectRoot: string): {
  exists: boolean;
  hasSection: boolean;
  version: string | null;
  needsUpdate: boolean;
} {
  const claudeMdPath = join(projectRoot, 'CLAUDE.md');

  if (!existsSync(claudeMdPath)) {
    return {
      exists: false,
      hasSection: false,
      version: null,
      needsUpdate: true,
    };
  }

  const content = readFileSync(claudeMdPath, 'utf-8');
  const hasSection = hasKrolikSection(content);
  const version = hasSection ? extractVersion(content) : null;

  return {
    exists: true,
    hasSection,
    version,
    needsUpdate: !hasSection || version !== DOCS_VERSION,
  };
}
