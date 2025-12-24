/**
 * @module commands/fix/composite/operations
 * @description High-level composite operations
 *
 * Provides factory functions to create composite transforms:
 * - Rename: Change identifier name across project
 * - Move: Move file to new location with import updates
 * - Extract: Extract code to new file with re-exports
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Glob } from 'glob';
import { SyntaxKind } from 'ts-morph';
import { escapeRegex } from '../../../lib/@sanitize/regex';
import type { FixOperation } from '../types';
import type {
  CompositeStep,
  CompositeTransform,
  ExtractConfig,
  MoveConfig,
  RenameConfig,
  VerificationConfig,
} from './types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate transform ID
 */
function generateId(): string {
  return `ct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Find all TypeScript files in project
 */
function findTsFiles(projectRoot: string, pattern = '**/*.{ts,tsx}'): string[] {
  try {
    const glob = new Glob(pattern, { cwd: projectRoot, absolute: true });
    return [...glob];
  } catch {
    return [];
  }
}

// ============================================================================
// RENAME COMPOSITE
// ============================================================================

/**
 * Create a rename composite transform
 *
 * Renames an identifier across all files that import/use it
 */
export function createRenameTransform(
  projectRoot: string,
  config: Omit<RenameConfig, 'type'> & { sourceFile: string },
  verification?: VerificationConfig,
): CompositeTransform {
  const { from, to, sourceFile, scope = 'project' } = config;

  const affectedFiles: string[] = [sourceFile];
  const steps: CompositeStep[] = [];

  // Step 1: Rename in source file
  const sourceOperations = createRenameOperations(sourceFile, from, to);

  steps.push({
    type: 'rename',
    description: `Rename "${from}" to "${to}" in ${path.basename(sourceFile)}`,
    files: [sourceFile],
    config: { type: 'rename', from, to, scope },
    operations: sourceOperations,
  });

  // Step 2: Update all importing files (if project scope)
  if (scope === 'project') {
    const tsFiles = findTsFiles(projectRoot);
    const importingFiles = findFilesImporting(tsFiles, sourceFile, from);

    for (const file of importingFiles) {
      if (file === sourceFile) continue;

      affectedFiles.push(file);
      const importOperations = createImportRenameOperations(file, from, to);

      steps.push({
        type: 'update-imports',
        description: `Update import of "${from}" to "${to}" in ${path.basename(file)}`,
        files: [file],
        config: { type: 'rename', from, to },
        operations: importOperations,
      });
    }
  }

  const result: CompositeTransform = {
    id: generateId(),
    name: `Rename ${from} → ${to}`,
    description: `Rename identifier "${from}" to "${to}" across ${affectedFiles.length} files`,
    steps,
    affectedFiles,
  };

  if (verification) {
    result.verification = verification;
  }

  return result;
}

/**
 * Create rename operations for a single file
 */
function createRenameOperations(file: string, from: string, to: string): FixOperation[] {
  const operations: FixOperation[] = [];

  try {
    const content = fs.readFileSync(file, 'utf-8');
    const { astPool } = require('../core/ast-pool');
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);

      for (const id of identifiers) {
        if (id.getText() === from) {
          const line = id.getStartLineNumber();
          const lineText = content.split('\n')[line - 1] ?? '';
          const newLineText = lineText.replace(new RegExp(`\\b${from}\\b`, 'g'), to);

          // Avoid duplicates for same line
          if (!operations.some((op) => op.line === line)) {
            operations.push({
              file,
              action: 'replace-line',
              line,
              newCode: newLineText,
            });
          }
        }
      }
    } finally {
      cleanup();
    }
  } catch {
    // If AST fails, use simple regex
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((line, i) => {
      if (new RegExp(`\\b${from}\\b`).test(line)) {
        operations.push({
          file,
          action: 'replace-line',
          line: i + 1,
          newCode: line.replace(new RegExp(`\\b${from}\\b`, 'g'), to),
        });
      }
    });
  }

  return operations;
}

/**
 * Create import rename operations
 */
function createImportRenameOperations(file: string, from: string, to: string): FixOperation[] {
  return createRenameOperations(file, from, to);
}

/**
 * Find files that import a specific export from a file
 */
function findFilesImporting(files: string[], sourceFile: string, exportName: string): string[] {
  const importing: string[] = [];
  const sourceBasename = path.basename(sourceFile, path.extname(sourceFile));

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Check if file imports from source
      const importPattern = new RegExp(
        `import\\s+.*\\b${exportName}\\b.*from\\s+['"][^'"]*${sourceBasename}['"]`,
      );

      if (importPattern.test(content)) {
        importing.push(file);
      }
    } catch {
      // Skip unreadable files
    }
  }

  return importing;
}

// ============================================================================
// MOVE COMPOSITE
// ============================================================================

/**
 * Create a move composite transform
 *
 * Moves a file and updates all import paths
 */
export function createMoveTransform(
  projectRoot: string,
  config: Omit<MoveConfig, 'type'>,
  verification?: VerificationConfig,
): CompositeTransform {
  const { from, to, updateImports = true } = config;

  const affectedFiles: string[] = [from];
  const steps: CompositeStep[] = [];

  // Step 1: Create new file with updated import paths
  const content = fs.readFileSync(from, 'utf-8');
  const updatedContent = updateImportPaths(content, from, to);

  steps.push({
    type: 'move',
    description: `Move ${path.basename(from)} to ${path.dirname(to)}`,
    files: [to],
    config: { type: 'move', from, to, updateImports },
    operations: [
      {
        file: to,
        action: 'split-file',
        newFiles: [{ path: to, content: updatedContent }],
      },
    ],
  });

  // Step 2: Update importing files
  if (updateImports) {
    const tsFiles = findTsFiles(projectRoot);
    const importingFiles = findFilesImportingPath(tsFiles, from);

    for (const file of importingFiles) {
      affectedFiles.push(file);

      steps.push({
        type: 'update-imports',
        description: `Update imports in ${path.basename(file)}`,
        files: [file],
        config: { type: 'move', from, to },
        operations: createUpdateImportOperations(file, from, to),
      });
    }
  }

  // Step 3: Delete original file
  steps.push({
    type: 'delete',
    description: `Delete original ${path.basename(from)}`,
    files: [from],
    config: { type: 'move', from, to },
    operations: [
      {
        file: from,
        action: 'delete-line',
        line: 1,
        // Special marker - applier will handle full file delete
        oldCode: '__DELETE_FILE__',
      },
    ],
  });

  const result: CompositeTransform = {
    id: generateId(),
    name: `Move ${path.basename(from)}`,
    description: `Move ${from} to ${to} and update ${affectedFiles.length - 1} import paths`,
    steps,
    affectedFiles,
  };

  if (verification) {
    result.verification = verification;
  }

  return result;
}

/**
 * Update import paths in file content when moving
 */
function updateImportPaths(content: string, from: string, to: string): string {
  const fromDir = path.dirname(from);
  const toDir = path.dirname(to);

  // Adjust relative imports based on new location
  return content.replace(/from\s+['"](\.[^'"]+)['"]/g, (_, importPath) => {
    // Resolve the absolute path of the import from old location
    const absoluteImport = path.resolve(fromDir, importPath);

    // Calculate new relative path from new location
    let newRelative = path.relative(toDir, absoluteImport);

    // Ensure it starts with ./ or ../
    if (!newRelative.startsWith('.')) {
      newRelative = `./${newRelative}`;
    }

    return `from '${newRelative}'`;
  });
}

/**
 * Find files that import from a specific path
 */
function findFilesImportingPath(files: string[], targetPath: string): string[] {
  const importing: string[] = [];
  const targetBasename = path.basename(targetPath, path.extname(targetPath));

  for (const file of files) {
    if (file === targetPath) continue;

    try {
      const content = fs.readFileSync(file, 'utf-8');

      // Simple check for import from this file
      if (content.includes(targetBasename)) {
        importing.push(file);
      }
    } catch {
      // Skip
    }
  }

  return importing;
}

/**
 * Create operations to update import paths
 */
function createUpdateImportOperations(
  file: string,
  oldPath: string,
  newPath: string,
): FixOperation[] {
  const operations: FixOperation[] = [];

  try {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const fileDir = path.dirname(file);

    // Calculate old and new relative paths
    const oldRelative = path.relative(fileDir, oldPath).replace(/\\/g, '/');
    const newRelative = path.relative(fileDir, newPath).replace(/\\/g, '/');

    // Fix relative path format
    const oldImport = oldRelative.startsWith('.') ? oldRelative : `./${oldRelative}`;
    const newImport = newRelative.startsWith('.') ? newRelative : `./${newRelative}`;

    lines.forEach((line, i) => {
      // Check if line imports from old path
      const oldBasename = path.basename(oldPath, path.extname(oldPath));
      if (line.includes('from') && line.includes(oldBasename)) {
        const newLine = line.replace(
          new RegExp(`(['"])${escapeRegex(oldImport.replace(/\.tsx?$/, ''))}(['"])`, 'g'),
          `$1${newImport.replace(/\.tsx?$/, '')}$2`,
        );

        if (newLine !== line) {
          operations.push({
            file,
            action: 'replace-line',
            line: i + 1,
            newCode: newLine,
          });
        }
      }
    });
  } catch {
    // Skip on error
  }

  return operations;
}

// ============================================================================
// EXTRACT COMPOSITE
// ============================================================================

/**
 * Create an extract composite transform
 *
 * Extracts code items (functions, types) to a new file with re-exports
 */
export function createExtractTransform(
  config: Omit<ExtractConfig, 'type'>,
  verification?: VerificationConfig,
): CompositeTransform {
  const { sourceFile, targetFile, items, reexport = true } = config;

  const steps: CompositeStep[] = [];

  // Step 1: Create new file with extracted items
  const { extractedContent, remainingContent, exportStatement } = extractItems(
    sourceFile,
    items,
    targetFile,
  );

  steps.push({
    type: 'extract',
    description: `Create ${path.basename(targetFile)} with extracted items`,
    files: [targetFile],
    config: { type: 'extract', sourceFile, targetFile, items, reexport },
    operations: [
      {
        file: targetFile,
        action: 'split-file',
        newFiles: [{ path: targetFile, content: extractedContent }],
      },
    ],
  });

  // Step 2: Update source file (remove extracted, add re-export)
  let updatedSource = remainingContent;
  if (reexport && exportStatement) {
    updatedSource += `\n${exportStatement}`;
  }

  steps.push({
    type: 'update-exports',
    description: `Update ${path.basename(sourceFile)} with re-exports`,
    files: [sourceFile],
    config: { type: 'extract', sourceFile, targetFile, items },
    operations: [
      {
        file: sourceFile,
        action: 'replace-range',
        line: 1,
        endLine: fs.readFileSync(sourceFile, 'utf-8').split('\n').length,
        newCode: updatedSource,
      },
    ],
  });

  const result: CompositeTransform = {
    id: generateId(),
    name: `Extract to ${path.basename(targetFile)}`,
    description: `Extract ${items.join(', ')} to ${targetFile}`,
    steps,
    affectedFiles: [sourceFile, targetFile],
  };

  if (verification) {
    result.verification = verification;
  }

  return result;
}

/**
 * Extract items from a file
 */
function extractItems(
  sourceFile: string,
  items: string[],
  targetFile: string,
): {
  extractedContent: string;
  remainingContent: string;
  exportStatement: string;
} {
  const content = fs.readFileSync(sourceFile, 'utf-8');
  const { astPool } = require('../core/ast-pool');
  const [source, cleanup] = astPool.createSourceFile(content, sourceFile);

  try {
    const extractedParts: string[] = [];
    const removedRanges: Array<{ start: number; end: number }> = [];

    // Find and extract each item
    for (const item of items) {
      // Try function
      const func = source.getFunction(item);
      if (func) {
        extractedParts.push(func.getText());
        removedRanges.push({
          start: func.getStart(),
          end: func.getEnd(),
        });
        continue;
      }

      // Try type alias
      const typeAlias = source.getTypeAlias(item);
      if (typeAlias) {
        extractedParts.push(typeAlias.getText());
        removedRanges.push({
          start: typeAlias.getStart(),
          end: typeAlias.getEnd(),
        });
        continue;
      }

      // Try interface
      const iface = source.getInterface(item);
      if (iface) {
        extractedParts.push(iface.getText());
        removedRanges.push({
          start: iface.getStart(),
          end: iface.getEnd(),
        });
        continue;
      }

      // Try variable
      const variable = source.getVariableDeclaration(item);
      if (variable) {
        const stmt = variable.getFirstAncestorByKind(SyntaxKind.VariableStatement);
        if (stmt) {
          extractedParts.push(stmt.getText());
          removedRanges.push({
            start: stmt.getStart(),
            end: stmt.getEnd(),
          });
        }
      }
    }

    // Build extracted content
    const extractedContent = extractedParts.join('\n\n');

    // Build remaining content (remove extracted ranges)
    let remaining = content;
    // Sort ranges in reverse order to preserve positions
    removedRanges.sort((a, b) => b.start - a.start);

    for (const range of removedRanges) {
      remaining = remaining.slice(0, range.start) + remaining.slice(range.end);
    }

    // Create export statement
    const relativePath = `./${path.basename(targetFile, path.extname(targetFile))}`;
    const exportStatement = `export { ${items.join(', ')} } from '${relativePath}';`;

    return {
      extractedContent,
      remainingContent: remaining.trim(),
      exportStatement,
    };
  } finally {
    cleanup();
  }
}
