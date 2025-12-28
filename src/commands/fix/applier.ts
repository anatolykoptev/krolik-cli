/**
 * @module commands/fix/applier
 * @description Apply fix operations to files using patch-based approach
 *
 * Uses byte-offset patches instead of line-by-line manipulation for O(1)
 * patch building and efficient batch application.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileCache } from '@/lib';
import type { FixOperation, FixResult, QualityIssue } from './types';

// ============================================================================
// PATCH TYPES
// ============================================================================

/**
 * A text patch representing a byte-range replacement
 */
interface TextPatch {
  /** Start byte offset (inclusive) */
  start: number;
  /** End byte offset (exclusive) */
  end: number;
  /** Replacement text */
  replacement: string;
}

// ============================================================================
// PATCH HELPERS
// ============================================================================

/**
 * Cache for line offsets to avoid recomputation
 * Maps content hash to array of line start offsets
 */
const lineOffsetCache = new WeakMap<object, number[]>();

/**
 * Get or compute line start offsets for content
 * Returns array where index i = byte offset of line (i+1)
 */
function getLineOffsets(content: string, cacheKey?: object): number[] {
  if (cacheKey) {
    const cached = lineOffsetCache.get(cacheKey);
    if (cached) return cached;
  }

  const offsets: number[] = [0]; // Line 1 starts at offset 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      offsets.push(i + 1); // Next line starts after newline
    }
  }

  if (cacheKey) {
    lineOffsetCache.set(cacheKey, offsets);
  }

  return offsets;
}

/**
 * Convert line number to byte offset
 * @param content File content
 * @param lineNumber 1-based line number
 * @param offsets Pre-computed line offsets (optional)
 * @returns Byte offset of line start
 */
function lineToOffset(content: string, lineNumber: number, offsets?: number[]): number {
  const lineOffsets = offsets ?? getLineOffsets(content);
  const idx = lineNumber - 1;
  if (idx < 0 || idx >= lineOffsets.length) {
    throw new Error(`Line ${lineNumber} out of range (1-${lineOffsets.length})`);
  }
  return lineOffsets[idx]!;
}

/**
 * Get byte offset of line end (including newline if present)
 * @param content File content
 * @param lineNumber 1-based line number
 * @param offsets Pre-computed line offsets (optional)
 * @returns Byte offset after line end (including newline)
 */
function lineEndOffset(content: string, lineNumber: number, offsets?: number[]): number {
  const lineOffsets = offsets ?? getLineOffsets(content);
  const idx = lineNumber - 1;
  if (idx < 0 || idx >= lineOffsets.length) {
    throw new Error(`Line ${lineNumber} out of range (1-${lineOffsets.length})`);
  }

  // If there's a next line, end is at its start
  if (idx + 1 < lineOffsets.length) {
    return lineOffsets[idx + 1]!;
  }

  // Last line - end at content length
  return content.length;
}

/**
 * Apply multiple patches to content in a single pass
 * Patches must be sorted by start offset descending (bottom to top)
 * to preserve offset validity
 *
 * @param content Original content
 * @param patches Patches sorted by start descending
 * @returns Modified content
 */
function applyPatches(content: string, patches: TextPatch[]): string {
  // Fast path: no patches
  if (patches.length === 0) return content;

  // Fast path: single patch
  if (patches.length === 1) {
    const p = patches[0]!;
    return content.slice(0, p.start) + p.replacement + content.slice(p.end);
  }

  // Multiple patches: build result from segments
  // Patches are sorted descending by start, so we process bottom-to-top
  // and build the result in reverse order
  const segments: string[] = [];
  let lastEnd = content.length;

  for (const patch of patches) {
    // Add unchanged content after this patch
    if (patch.end < lastEnd) {
      segments.push(content.slice(patch.end, lastEnd));
    }
    // Add replacement
    segments.push(patch.replacement);
    lastEnd = patch.start;
  }

  // Add content before first patch
  if (lastEnd > 0) {
    segments.push(content.slice(0, lastEnd));
  }

  // Reverse and join (we built in reverse order)
  return segments.reverse().join('');
}

/**
 * Create a patch for deleting a line
 */
function createDeleteLinePatch(content: string, lineNumber: number, offsets: number[]): TextPatch {
  return {
    start: lineToOffset(content, lineNumber, offsets),
    end: lineEndOffset(content, lineNumber, offsets),
    replacement: '',
  };
}

/**
 * Create a patch for replacing a line
 */
function createReplaceLinePatch(
  content: string,
  lineNumber: number,
  newCode: string,
  offsets: number[],
): TextPatch {
  const start = lineToOffset(content, lineNumber, offsets);
  const end = lineEndOffset(content, lineNumber, offsets);

  // Preserve trailing newline if original had one
  const hasNewline = end > start && content[end - 1] === '\n';
  const replacement = hasNewline ? `${newCode}\n` : newCode;

  return { start, end, replacement };
}

/**
 * Create a patch for replacing a range of lines
 */
function createReplaceRangePatch(
  content: string,
  startLine: number,
  endLine: number,
  newCode: string,
  offsets: number[],
): TextPatch {
  const start = lineToOffset(content, startLine, offsets);
  const end = lineEndOffset(content, endLine, offsets);

  // Preserve trailing newline if original range had one
  const hasNewline = end > start && content[end - 1] === '\n';
  const replacement = hasNewline ? `${newCode}\n` : newCode;

  return { start, end, replacement };
}

/**
 * Create a patch for inserting before a line
 */
function createInsertBeforePatch(
  content: string,
  lineNumber: number,
  newCode: string,
  offsets: number[],
): TextPatch {
  const start = lineToOffset(content, lineNumber, offsets);
  return {
    start,
    end: start, // Zero-width patch = insertion
    replacement: `${newCode}\n`,
  };
}

/**
 * Create a patch for inserting after a line
 */
function createInsertAfterPatch(
  content: string,
  lineNumber: number,
  newCode: string,
  offsets: number[],
): TextPatch {
  const end = lineEndOffset(content, lineNumber, offsets);
  return {
    start: end,
    end, // Zero-width patch = insertion
    replacement: `${newCode}\n`,
  };
}

// ============================================================================
// FILE OPERATIONS
// ============================================================================

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
 * Convert a FixOperation to a TextPatch
 * Returns null for operations that don't produce patches (like split-file)
 */
function operationToPatch(
  operation: FixOperation,
  content: string,
  offsets: number[],
): TextPatch | null {
  const { action, line, endLine, newCode } = operation;

  switch (action) {
    case 'delete-line': {
      if (!line) throw new Error('Line number required for delete-line');
      return createDeleteLinePatch(content, line, offsets);
    }

    case 'replace-line': {
      if (!line || newCode === undefined) {
        throw new Error('Line number and newCode required for replace-line');
      }
      return createReplaceLinePatch(content, line, newCode, offsets);
    }

    case 'replace-range': {
      if (!line || !endLine || newCode === undefined) {
        throw new Error('Line range and newCode required for replace-range');
      }
      return createReplaceRangePatch(content, line, endLine, newCode, offsets);
    }

    case 'insert-before': {
      if (!line || newCode === undefined) {
        throw new Error('Line number and newCode required for insert-before');
      }
      return createInsertBeforePatch(content, line, newCode, offsets);
    }

    case 'insert-after': {
      if (!line || newCode === undefined) {
        throw new Error('Line number and newCode required for insert-after');
      }
      return createInsertAfterPatch(content, line, newCode, offsets);
    }

    case 'extract-function': {
      // Insert extracted function before the current line
      if (!line || newCode === undefined) {
        throw new Error('Line and newCode required for extract-function');
      }
      return createInsertBeforePatch(content, line, newCode, offsets);
    }

    case 'split-file':
    case 'move-file':
    case 'create-barrel':
    case 'wrap-function':
      // These don't produce simple text patches
      return null;

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Handle split-file operation (special case - creates new files)
 */
function handleSplitFile(
  operation: FixOperation,
  content: string,
  options: { dryRun?: boolean },
): string {
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
  const originalFileUpdate = operation.newFiles.find((f) => f.path === operation.file);
  return originalFileUpdate?.content ?? content;
}

/**
 * Apply a single fix operation using patch-based approach
 *
 * Uses byte-offset patches instead of split/splice/join for better performance:
 * - O(n) to compute line offsets once
 * - O(1) to create each patch
 * - O(n) single pass to apply patches
 *
 * vs old approach:
 * - O(n) split for each fix
 * - O(n) array copy for each fix
 * - O(n) join for each fix
 */
export function applyFix(
  operation: FixOperation,
  issue: QualityIssue,
  options: { backup?: boolean; dryRun?: boolean } = {},
): FixResult {
  const { file, action } = operation;

  try {
    // Read current content (using cache to avoid repeated reads)
    const content = fileCache.get(file);

    // Create backup if requested
    let backup: string | undefined;
    if (options.backup && !options.dryRun) {
      backup = content;
      createBackup(file);
    }

    let newContent: string;

    // Handle special cases that don't use patches
    if (action === 'split-file') {
      newContent = handleSplitFile(operation, content, options);
    } else {
      // Convert operation to patch and apply
      const offsets = getLineOffsets(content);
      const patch = operationToPatch(operation, content, offsets);

      if (patch) {
        // Apply single patch
        newContent = applyPatches(content, [patch]);
      } else {
        // No patch produced (e.g., unsupported operation)
        newContent = content;
      }
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
 * Apply multiple fixes to a single file using batch patch approach
 *
 * This is more efficient than calling applyFix repeatedly because:
 * - Line offsets are computed once for the original content
 * - All patches are built upfront
 * - Patches are applied in a single pass
 *
 * Fixes are applied in reverse line order (bottom to top) to preserve offsets.
 */
export function applyFixes(
  file: string,
  operations: Array<{ operation: FixOperation; issue: QualityIssue }>,
  options: { backup?: boolean; dryRun?: boolean } = {},
): FixResult[] {
  // Fast path: no operations
  if (operations.length === 0) return [];

  // Fast path: single operation - use applyFix directly
  if (operations.length === 1) {
    const op = operations[0]!;
    return [applyFix(op.operation, op.issue, options)];
  }

  try {
    // Read content once
    const content = fileCache.get(file);

    // Create single backup for the file
    if (options.backup && !options.dryRun) {
      createBackup(file);
    }

    // Separate patch-based operations from special operations
    const patchOps: Array<{ operation: FixOperation; issue: QualityIssue }> = [];
    const specialOps: Array<{ operation: FixOperation; issue: QualityIssue }> = [];

    for (const op of operations) {
      if (op.operation.action === 'split-file') {
        specialOps.push(op);
      } else {
        patchOps.push(op);
      }
    }

    // Sort patch operations by line number descending
    const sortedPatchOps = [...patchOps].sort((a, b) => {
      const lineA = a.operation.line || 0;
      const lineB = b.operation.line || 0;
      return lineB - lineA;
    });

    // Compute line offsets once
    const offsets = getLineOffsets(content);

    // Build all patches
    const patches: TextPatch[] = [];
    const patchResults: FixResult[] = [];

    for (const { operation, issue } of sortedPatchOps) {
      try {
        const patch = operationToPatch(operation, content, offsets);
        if (patch) {
          patches.push(patch);
        }
        patchResults.push({ issue, operation, success: true });
      } catch (error) {
        patchResults.push({
          issue,
          operation,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        // Stop on first error
        break;
      }
    }

    // Apply all patches in single pass (already sorted descending by line)
    let newContent = applyPatches(content, patches);

    // Handle special operations (split-file etc) - these need to run after patches
    const specialResults: FixResult[] = [];
    for (const { operation, issue } of specialOps) {
      try {
        if (operation.action === 'split-file') {
          newContent = handleSplitFile(operation, newContent, options);
          specialResults.push({ issue, operation, success: true });
        }
      } catch (error) {
        specialResults.push({
          issue,
          operation,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        break;
      }
    }

    // Write new content
    if (!options.dryRun) {
      fs.writeFileSync(file, newContent);
      fileCache.set(file, newContent);
    } else {
      fileCache.set(file, newContent);
    }

    return [...patchResults, ...specialResults];
  } catch (error) {
    // If we fail to even read the file, return error for all operations
    return operations.map(({ operation, issue }) => ({
      issue,
      operation,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
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
