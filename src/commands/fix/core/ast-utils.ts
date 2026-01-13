/**
 * @module commands/fix/core/ast-utils
 * @description AST utilities for fixers
 *
 * Shared AST operations used across multiple fixers.
 */

import { SyntaxKind } from 'ts-morph';
import { astPool } from '@/lib/@ast';

/**
 * Find the best line to insert a declaration (after imports)
 *
 * Scans through file statements and finds the last import line.
 * Returns 0 if no imports found or on error.
 *
 * @param content - File content
 * @param file - File path (for AST parsing)
 * @returns Line number after last import, or 0
 *
 * @example
 * ```ts
 * const insertLine = findInsertionLine(content, 'src/utils.ts');
 * if (insertLine > 0) {
 *   // Insert after imports
 * }
 * ```
 */
export function findInsertionLine(content: string, file: string): number {
  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      const statements = sourceFile.getStatements();
      let lastImportLine = 0;

      for (const statement of statements) {
        if (
          statement.getKind() === SyntaxKind.ImportDeclaration ||
          statement.getKind() === SyntaxKind.ImportEqualsDeclaration
        ) {
          lastImportLine = statement.getEndLineNumber();
        } else {
          break;
        }
      }

      return lastImportLine > 0 ? lastImportLine : 0;
    } finally {
      cleanup();
    }
  } catch {
    return 0;
  }
}
