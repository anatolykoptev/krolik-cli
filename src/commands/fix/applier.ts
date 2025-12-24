/**
 * @module commands/fix/applier
 * @description Apply fix operations to files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileCache } from '@/lib';
import type { FixOperation, FixResult, QualityIssue } from './types';

/**
 * Create backup of file
 */
export function createBackup(filePath: string): string {
  const content = fileCache.get(filePath);
  const backupPath = `${filePath}.backup.${Date.now()}`;
  fs.writeFileSync(backupPath, content);
  return backupPath;
}

/**
 * Apply a single fix operation
 */
export function applyFix(
  operation: FixOperation,
  issue: QualityIssue,
  options: { backup?: boolean; dryRun?: boolean } = {},
): FixResult {
  const { file, action, line, endLine, newCode } = operation;

  try {
    // Read current content (using cache to avoid repeated reads)
    const content = fileCache.get(file);
    const lines = content.split('\n');

    // Create backup if requested
    let backup: string | undefined;
    if (options.backup && !options.dryRun) {
      backup = content;
      createBackup(file);
    }

    let newContent: string;

    switch (action) {
      case 'delete-line': {
        if (!line) throw new Error('Line number required for delete-line');
        const newLines = [...lines];
        newLines.splice(line - 1, 1);
        newContent = newLines.join('\n');
        break;
      }

      case 'replace-line': {
        if (!line || newCode === undefined) {
          throw new Error('Line number and newCode required for replace-line');
        }
        const newLines = [...lines];
        newLines[line - 1] = newCode;
        newContent = newLines.join('\n');
        break;
      }

      case 'replace-range': {
        if (!line || !endLine || newCode === undefined) {
          throw new Error('Line range and newCode required for replace-range');
        }
        const newLines = [...lines];
        newLines.splice(line - 1, endLine - line + 1, newCode);
        newContent = newLines.join('\n');
        break;
      }

      case 'insert-before': {
        if (!line || newCode === undefined) {
          throw new Error('Line number and newCode required for insert-before');
        }
        const newLines = [...lines];
        newLines.splice(line - 1, 0, newCode);
        newContent = newLines.join('\n');
        break;
      }

      case 'insert-after': {
        if (!line || newCode === undefined) {
          throw new Error('Line number and newCode required for insert-after');
        }
        const newLines = [...lines];
        newLines.splice(line, 0, newCode);
        newContent = newLines.join('\n');
        break;
      }

      case 'extract-function': {
        // For now, just insert TODO - full extraction is complex
        if (!line || newCode === undefined) {
          throw new Error('Line and newCode required for extract-function');
        }
        const newLines = [...lines];
        // Insert the extracted function before the current line
        newLines.splice(line - 1, 0, newCode);
        newContent = newLines.join('\n');
        break;
      }

      case 'split-file': {
        // Create new files
        if (!operation.newFiles || operation.newFiles.length === 0) {
          throw new Error('newFiles required for split-file');
        }
        if (!options.dryRun) {
          for (const newFile of operation.newFiles) {
            const dir = path.dirname(newFile.path);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(newFile.path, newFile.content);
          }
        }
        // Find the original file in newFiles (it should contain re-exports)
        const originalFileUpdate = operation.newFiles.find((f) => f.path === file);
        newContent = originalFileUpdate?.content ?? content;
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Write new content
    if (!options.dryRun) {
      fs.writeFileSync(file, newContent);
      // Update cache to keep it consistent with disk state
      fileCache.set(file, newContent);
    } else {
      // In dry-run mode, update cache for subsequent operations in same session
      fileCache.set(file, newContent);
    }

    const result: FixResult = {
      issue,
      operation,
      success: true,
    };
    if (backup !== undefined) {
      result.backup = backup;
    }
    return result;
  } catch (error) {
    return {
      issue,
      operation,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Apply multiple fixes to a single file
 * Fixes are applied in reverse line order to preserve line numbers
 */
export function applyFixes(
  file: string,
  operations: Array<{ operation: FixOperation; issue: QualityIssue }>,
  options: { backup?: boolean; dryRun?: boolean } = {},
): FixResult[] {
  // Sort by line number descending (apply from bottom to top)
  const sorted = [...operations].sort((a, b) => {
    const lineA = a.operation.line || 0;
    const lineB = b.operation.line || 0;
    return lineB - lineA;
  });

  // Create single backup for the file
  if (options.backup && !options.dryRun) {
    createBackup(file);
  }

  const results: FixResult[] = [];

  for (const { operation, issue } of sorted) {
    const result = applyFix(operation, issue, { ...options, backup: false });
    results.push(result);

    // Stop on first error
    if (!result.success) {
      break;
    }
  }

  return results;
}

/**
 * Rollback a fix using backup
 */
export function rollbackFix(filePath: string, backupContent: string): boolean {
  try {
    fs.writeFileSync(filePath, backupContent);
    return true;
  } catch {
    return false;
  }
}
