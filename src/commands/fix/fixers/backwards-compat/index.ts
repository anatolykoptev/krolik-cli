/**
 * @module commands/fix/fixers/backwards-compat
 * @description Backwards-compatibility shim cleanup fixer
 *
 * Detects deprecated re-export files and provides cleanup:
 * 1. Finds all files importing the deprecated module
 * 2. Updates imports to point to the new location
 * 3. Deletes the deprecated shim file
 *
 * Uses existing infrastructure:
 * - @detectors/backwards-compat for detection
 * - @discovery/paths for dynamic path resolution
 * - refactor/migration/imports for import updates
 *
 * No hardcoded paths - works with any project structure.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectBackwardsCompat } from '@/lib/@detectors';
import { createPathResolver } from '@/lib/@discovery/paths';
import { findAffectedImports, updateImports } from '../../../refactor/migration/imports';
import { createFixerMetadata } from '../../core/registry';
import type { Fixer, FixOperation, QualityIssue } from '../../core/types';

// ============================================================================
// METADATA
// ============================================================================

export const metadata = createFixerMetadata(
  'backwards-compat',
  'Backwards Compat Cleanup',
  'backwards-compat',
  {
    description: 'Delete deprecated shim files and update imports',
    difficulty: 'risky', // TODO: not production-ready
    cliFlag: '--cleanup-deprecated',
    tags: ['safe', 'refactoring', 'cleanup'],
  },
);

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Analyze file for backwards-compat shim patterns
 */
function analyzeBackwardsCompat(content: string, file: string): QualityIssue[] {
  const detection = detectBackwardsCompat(content, file);

  if (!detection.isShim) {
    return [];
  }

  // Build issue with conditionally included optional properties
  const issue: QualityIssue = {
    file,
    line: detection.deprecatedLines[0] || 1,
    severity: 'warning',
    category: 'backwards-compat',
    message: `Backwards-compat shim file (${detection.confidence}% confidence): ${detection.reason}`,
    suggestion: detection.suggestion,
  };

  // Only add snippet if movedTo is defined
  if (detection.movedTo) {
    issue.snippet = `→ ${detection.movedTo}`;
  }

  return [issue];
}

// ============================================================================
// CLEANUP LOGIC
// ============================================================================

/**
 * Clean up a deprecated shim file
 *
 * Steps:
 * 1. Find all files importing from the deprecated path
 * 2. Update their imports to point to the new target
 * 3. Delete the deprecated file
 *
 * Uses dynamic path resolution - no hardcoded paths.
 * Works with any project structure (monorepo, single package, etc.)
 */
export async function cleanupDeprecatedFile(
  deprecatedPath: string,
  targetPath: string,
  projectRoot: string,
  dryRun = false,
): Promise<{
  success: boolean;
  updatedFiles: string[];
  deleted: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  const updatedFiles: string[] = [];

  // Use dynamic path resolution
  const resolver = createPathResolver(projectRoot);
  const sourceDir = resolver.sourceDir;

  // Normalize deprecated path - could be relative to source or absolute
  let deprecatedRelative: string;
  if (deprecatedPath.startsWith(`${sourceDir}/`)) {
    deprecatedRelative = deprecatedPath;
  } else if (deprecatedPath.startsWith('/') || path.isAbsolute(deprecatedPath)) {
    deprecatedRelative = path.relative(projectRoot, deprecatedPath);
  } else {
    deprecatedRelative = `${sourceDir}/${deprecatedPath}`;
  }

  // Find all files that import from the deprecated path
  const affected = await findAffectedImports(deprecatedRelative, projectRoot);

  if (dryRun) {
    return {
      success: true,
      updatedFiles: affected,
      deleted: false,
      errors: [],
    };
  }

  // Update imports in affected files (no libPath needed - uses dynamic detection)
  for (const file of affected) {
    const result = await updateImports(
      file,
      deprecatedRelative.replace('.ts', ''),
      targetPath.replace('.ts', ''),
      projectRoot,
    );

    if (result.changed) {
      updatedFiles.push(file);
    }
    if (!result.success) {
      errors.push(...result.errors.map((e) => `${file}: ${e}`));
    }
  }

  // Delete the deprecated file
  let deleted = false;
  const deprecatedFullPath = path.join(projectRoot, deprecatedRelative);

  if (fs.existsSync(deprecatedFullPath)) {
    try {
      fs.unlinkSync(deprecatedFullPath);
      deleted = true;
    } catch (e) {
      errors.push(
        `Failed to delete ${deprecatedPath}: ${e instanceof Error ? e.message : 'Unknown error'}`,
      );
    }
  }

  return {
    success: errors.length === 0,
    updatedFiles,
    deleted,
    errors,
  };
}

// ============================================================================
// FIXER
// ============================================================================

/**
 * Fix backwards-compat issue by cleaning up the shim file
 */
function fixBackwardsCompat(issue: QualityIssue, _content: string): FixOperation | null {
  // Extract target path from snippet (→ @/lib/new-path)
  const targetMatch = issue.snippet?.match(/^→\s*(.+)$/);
  const targetPath = targetMatch?.[1];

  if (!targetPath) {
    // No target path - can't auto-fix
    return null;
  }

  // Return a composite operation that will be handled specially
  return {
    action: 'delete-line',
    file: issue.file,
    line: 1,
    oldCode: `// Deprecated shim: ${issue.file}`,
    newCode: `// CLEANUP: Delete this file and update imports to ${targetPath}`,
    // Store metadata for the composite executor
    // @ts-expect-error - extending FixOperation with custom fields
    _backwardsCompat: {
      deprecatedPath: issue.file,
      targetPath,
    },
  };
}

// ============================================================================
// FIXER EXPORT
// ============================================================================

export const backwardsCompatFixer: Fixer = {
  metadata,
  analyze: analyzeBackwardsCompat,
  fix: fixBackwardsCompat,

  shouldSkip(_issue: QualityIssue, _content: string): boolean {
    return false;
  },
};
