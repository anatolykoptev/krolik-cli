/**
 * @module commands/fix/fixers/unused-imports/analyzer
 * @description Detect unused imports using ts-morph AST analysis
 *
 * Uses centralized AST utilities from @ast for accurate parsing.
 */

import {
  astPool,
  type createSourceFile,
  extractImports,
  type ImportInfo,
  Node,
  SyntaxKind,
} from '@/lib/@ast';
import type { QualityIssue } from '../../core/types';

/**
 * Get all identifiers used in a source file (excluding imports)
 */
function getUsedIdentifiers(sourceFile: ReturnType<typeof createSourceFile>): Set<string> {
  const used = new Set<string>();
  const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);

  for (const id of identifiers) {
    const parent = id.getParent();

    // Skip import declarations - we only want usages
    if (parent && Node.isImportSpecifier(parent)) continue;
    if (parent && Node.isImportClause(parent)) continue;
    if (parent && Node.isNamespaceImport(parent)) continue;

    // Skip export specifiers
    if (parent && Node.isExportSpecifier(parent)) continue;

    // Skip type references in imports
    if (parent && Node.isImportDeclaration(parent)) continue;

    used.add(id.getText());
  }

  return used;
}

/**
 * Convert ImportInfo to local format with line content
 */
interface LocalImportInfo {
  line: number;
  lineContent: string;
  identifiers: string[];
  source: string;
}

/**
 * Extract import info with line content
 */
function getImportsWithContent(
  sourceFile: ReturnType<typeof createSourceFile>,
  content: string,
): LocalImportInfo[] {
  const imports = extractImports(sourceFile);
  const lines = content.split('\n');

  return imports.map((imp: ImportInfo) => {
    const identifiers: string[] = [];

    // Add default import
    if (imp.defaultImport) {
      identifiers.push(imp.defaultImport);
    }

    // Add namespace import
    if (imp.namespaceImport) {
      identifiers.push(imp.namespaceImport);
    }

    // Add named imports
    identifiers.push(...imp.namedImports);

    return {
      line: imp.line,
      lineContent: lines[imp.line - 1] ?? '',
      identifiers,
      source: imp.module,
    };
  });
}

/**
 * Analyze content for unused imports using ts-morph
 */
export function analyzeUnusedImports(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Get all used identifiers in the file
      const usedIdentifiers = getUsedIdentifiers(sourceFile);

      // Get imports with line content
      const imports = getImportsWithContent(sourceFile, content);

      for (const imp of imports) {
        // Find unused identifiers in this import
        const unusedIdentifiers = imp.identifiers.filter((id) => !usedIdentifiers.has(id));

        if (unusedIdentifiers.length === 0) continue;

        // All identifiers unused → entire import is unused
        if (unusedIdentifiers.length === imp.identifiers.length) {
          issues.push({
            file,
            line: imp.line,
            severity: 'warning',
            category: 'lint',
            message: `Unused import: entire import from '${imp.source}' is unused`,
            suggestion: 'Remove the import statement',
            snippet: imp.lineContent.trim(),
            fixerId: 'unused-imports',
          });
        } else {
          // Some identifiers unused
          for (const unusedId of unusedIdentifiers) {
            issues.push({
              file,
              line: imp.line,
              severity: 'warning',
              category: 'lint',
              message: `Unused import: '${unusedId}' from '${imp.source}'`,
              suggestion: `Remove '${unusedId}' from the import statement`,
              snippet: imp.lineContent.trim(),
              fixerId: 'unused-imports',
            });
          }
        }
      }

      return issues;
    } finally {
      cleanup();
    }
  } catch (_error) {
    // If ts-morph fails (invalid syntax), return empty
    // The file probably has syntax errors that need to be fixed first
    return [];
  }
}
