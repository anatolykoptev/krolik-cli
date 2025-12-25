/**
 * @module commands/fix/ast-utils/split-file
 * @description Split large files into modules (SRP fix)
 *
 * Uses AST analysis to safely split files while:
 * - Preserving imports
 * - Fixing relative import paths
 * - Generating cross-imports between new modules
 * - Creating barrel re-exports
 */

import * as path from 'node:path';
import { Node, SyntaxKind } from 'ts-morph';
import { astPool } from '@/lib/@ast';
import type { SplitConfig, SplitFileResult } from './types';

// ============================================================================
// IMPORT PATH UTILITIES
// ============================================================================

/**
 * Fix relative import paths when moving file to subdirectory
 *
 * When moving from `foo.ts` to `foo/functions.ts`:
 * - `./bar` → `../bar`
 * - `../baz` → `../../baz`
 * - `@/lib/utils` → unchanged (alias imports)
 * - `react` → unchanged (package imports)
 */
function fixRelativeImport(importPath: string): string {
  // Skip non-relative imports (packages, aliases)
  if (!importPath.startsWith('.')) {
    return importPath;
  }

  if (importPath.startsWith('./')) {
    // ./foo → ../foo (add one parent level)
    return `../${importPath.slice(2)}`;
  }

  if (importPath.startsWith('../')) {
    // ../foo → ../../foo (add one more parent level)
    return `../${importPath}`;
  }

  return importPath;
}

/**
 * Fix all import paths in import statements
 */
function fixImportsForSubdirectory(importsText: string): string {
  return importsText.replace(/from\s+['"]([^'"]+)['"]/g, (_, importPath) => {
    const fixed = fixRelativeImport(importPath);
    return `from '${fixed}'`;
  });
}

// ============================================================================
// GROUPING HELPERS
// ============================================================================

/**
 * Get group name based on node type
 */
function getGroupByType(node: Node): string {
  if (Node.isTypeAliasDeclaration(node) || Node.isInterfaceDeclaration(node)) {
    return 'types';
  }
  if (Node.isFunctionDeclaration(node)) {
    return 'functions';
  }
  if (Node.isVariableDeclaration(node)) {
    const init = node.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
      return 'functions';
    }
    const name = node.getName();
    if (name === name.toUpperCase() && name.length > 1) {
      return 'constants';
    }
  }
  if (Node.isClassDeclaration(node)) {
    return 'classes';
  }
  if (Node.isEnumDeclaration(node)) {
    return 'constants';
  }
  return 'utils';
}

const FUNCTION_PREFIXES = [
  'handle',
  'create',
  'get',
  'set',
  'is',
  'has',
  'can',
  'should',
  'format',
  'parse',
  'validate',
  'process',
  'transform',
  'build',
  'make',
  'find',
  'filter',
  'map',
  'reduce',
] as const;

/**
 * Get group name based on function prefix
 */
function getGroupByPrefix(name: string): string {
  const lowerName = name.toLowerCase();

  for (const prefix of FUNCTION_PREFIXES) {
    if (lowerName.startsWith(prefix)) {
      return `${prefix}s`;
    }
  }

  return 'utils';
}

// ============================================================================
// DECLARATION EXTRACTION
// ============================================================================

/**
 * Get declaration text with export keyword
 */
function getDeclarationText(decl: Node): string {
  let declText = '';

  if (Node.isVariableDeclaration(decl)) {
    const varStmt = decl.getFirstAncestorByKind(SyntaxKind.VariableStatement);
    if (varStmt) {
      declText = varStmt.getText();
    }
  } else if (
    Node.isFunctionDeclaration(decl) ||
    Node.isClassDeclaration(decl) ||
    Node.isInterfaceDeclaration(decl) ||
    Node.isTypeAliasDeclaration(decl) ||
    Node.isEnumDeclaration(decl)
  ) {
    declText = decl.getText();
  } else {
    const parent = decl.getParent();
    if (parent) {
      declText = parent.getText();
    } else {
      declText = decl.getText();
    }
  }

  // Add export if missing
  if (declText && !declText.startsWith('export') && !declText.startsWith('import')) {
    declText = `export ${declText}`;
  }

  return declText;
}

// ============================================================================
// MAIN SPLIT FUNCTION
// ============================================================================

/**
 * Split a file with too many exports into multiple modules
 *
 * Creates an Airbnb-style folder structure:
 * - `foo.ts` → `foo/index.ts`, `foo/functions.ts`, `foo/types.ts`
 *
 * @param content - Source file content
 * @param filePath - Path to the source file
 * @param config - Split configuration
 */
export function splitFile(
  content: string,
  filePath: string,
  config: SplitConfig = { byType: true },
): SplitFileResult {
  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, filePath);

    try {
      const groups = new Map<string, string[]>();
      const groupContents = new Map<string, string[]>();
      const imports = new Set<string>();

      // Collect imports
      for (const imp of sourceFile.getImportDeclarations()) {
        imports.add(imp.getText());
      }

      // Group exported items
      const exportedDeclarations = sourceFile.getExportedDeclarations();

      for (const [name, declarations] of exportedDeclarations) {
        if (declarations.length === 0) continue;
        const decl = declarations[0];
        if (!decl) continue;

        // Skip import declarations
        if (Node.isImportSpecifier(decl) || Node.isNamespaceImport(decl)) {
          continue;
        }

        const parent = decl.getParent();
        if (parent && Node.isImportDeclaration(parent)) {
          continue;
        }

        // Determine group
        let groupName = 'utils';
        if (config.groupFn) {
          groupName = config.groupFn(name, decl);
        } else if (config.byType) {
          groupName = getGroupByType(decl);
        } else if (config.byPrefix) {
          groupName = getGroupByPrefix(name);
        }

        if (!groups.has(groupName)) {
          groups.set(groupName, []);
          groupContents.set(groupName, []);
        }

        groups.get(groupName)?.push(name);

        const declText = getDeclarationText(decl);
        if (declText && !declText.startsWith('import')) {
          groupContents.get(groupName)?.push(declText);
        }
      }

      // Don't split if only 1-2 groups
      if (groups.size < 2) {
        return { success: false, error: 'File cannot be meaningfully split' };
      }

      // Generate files
      const baseName = path.basename(filePath, path.extname(filePath));
      const dir = path.dirname(filePath);
      const files: Array<{ path: string; content: string }> = [];
      const isIndexFile = baseName === 'index';

      const importsText = Array.from(imports).join('\n');
      const reExports: string[] = [];

      // Module directory
      const moduleDir = isIndexFile ? dir : path.join(dir, baseName);

      // Fix imports for subdirectory
      const fixedImportsText = isIndexFile ? importsText : fixImportsForSubdirectory(importsText);

      for (const [groupName, contents] of groupContents) {
        if (contents.length === 0) continue;

        const newFileName = `${groupName}.ts`;
        const newFilePath = path.join(moduleDir, newFileName);

        // Generate cross-imports between groups
        const crossImports: string[] = [];
        const contentText = contents.join('\n');

        for (const [otherGroup, otherNames] of groups) {
          if (otherGroup === groupName) continue;

          const usedNames = otherNames.filter((name) => {
            const regex = new RegExp(`\\b${name}\\b`, 'g');
            return regex.test(contentText);
          });

          if (usedNames.length > 0) {
            crossImports.push(`import { ${usedNames.join(', ')} } from './${otherGroup}';`);
          }
        }

        const crossImportsText = crossImports.length > 0 ? `${crossImports.join('\n')}\n` : '';
        const fileContent = `${fixedImportsText}\n${crossImportsText}\n${contents.join('\n\n')}\n`;
        files.push({ path: newFilePath, content: fileContent });

        reExports.push(`export * from './${groupName}';`);
      }

      if (reExports.length === 0) {
        return { success: false, error: 'No valid exports found to split' };
      }

      // Create barrel index.ts
      const barrelContent = `/**\n * @module ${baseName}\n * Re-exports from split modules\n */\n\n${reExports.join('\n')}\n`;
      const barrelPath = path.join(moduleDir, 'index.ts');
      files.push({ path: barrelPath, content: barrelContent });

      // Update original file for backwards compatibility
      if (!isIndexFile) {
        const originalReExport = `/**\n * @module ${baseName}\n * @deprecated Import from './${baseName}' folder instead\n */\n\nexport * from './${baseName}/index';\n`;
        files.push({ path: filePath, content: originalReExport });
      }

      return { success: true, files };
    } finally {
      cleanup();
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
