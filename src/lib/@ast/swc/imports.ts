/**
 * @module lib/@ast/swc/imports
 * @description SWC-based import extraction utilities
 *
 * Fast import parsing using SWC AST (10-20x faster than regex).
 * Used by both `context` and `refactor` commands.
 *
 * @example
 * ```ts
 * import { extractImports } from '@/lib/@ast/swc';
 *
 * const imports = extractImports(filePath, content);
 * for (const imp of imports) {
 *   console.log(`Import from ${imp.source}: ${imp.names.join(', ')}`);
 * }
 * ```
 */

// Import directly from source files to avoid circular dependency with ./index barrel
import { parseFile } from './parser';
import { visitNodeWithCallbacks } from './visitor';

/**
 * Parsed import statement
 */
export interface ImportInfo {
  /** Module specifier (e.g., '../utils', '@/lib/db') */
  source: string;
  /** Imported identifiers (e.g., ['useState', 'useEffect']) */
  names: string[];
  /** Whether this is a type-only import */
  isTypeOnly: boolean;
  /** Whether this is a default import */
  isDefault: boolean;
  /** Whether this is a namespace import (import * as X) */
  isNamespace: boolean;
  /** Line number (1-based) */
  line: number;
}

/**
 * Extract import statements from source code using SWC
 *
 * Faster than regex-based extraction (10-20x) and handles edge cases correctly.
 *
 * @param filePath - File path (for SWC syntax detection)
 * @param content - Source code content
 * @param options - Extraction options
 * @returns Array of parsed imports
 *
 * @example
 * ```ts
 * const imports = extractImports('src/app.tsx', sourceCode);
 * const localImports = imports.filter(i => i.source.startsWith('.'));
 * ```
 */
export function extractImports(
  filePath: string,
  content: string,
  options: {
    /** Include external package imports (default: true) */
    includeExternal?: boolean;
    /** Include type-only imports (default: true) */
    includeTypeOnly?: boolean;
  } = {},
): ImportInfo[] {
  const { includeExternal = true, includeTypeOnly = true } = options;
  const imports: ImportInfo[] = [];

  try {
    const { ast, lineOffsets } = parseFile(filePath, content);

    visitNodeWithCallbacks(ast, {
      onImportDeclaration: (node) => {
        const importNode = node as unknown as {
          source: { value: string };
          specifiers: Array<{
            type: string;
            local: { value: string };
          }>;
          typeOnly?: boolean;
          span: { start: number };
        };

        const source = importNode.source.value;

        // Filter external packages if requested
        if (!includeExternal) {
          if (!source.startsWith('.') && !source.startsWith('@/') && !source.startsWith('~/')) {
            return;
          }
        }

        // Filter type-only imports if requested
        const isTypeOnly = importNode.typeOnly ?? false;
        if (!includeTypeOnly && isTypeOnly) {
          return;
        }

        // Extract import info
        const names: string[] = [];
        let isDefault = false;
        let isNamespace = false;

        for (const spec of importNode.specifiers) {
          const name = spec.local?.value;
          if (name) {
            names.push(name);
          }

          if (spec.type === 'ImportDefaultSpecifier') {
            isDefault = true;
          }
          if (spec.type === 'ImportNamespaceSpecifier') {
            isNamespace = true;
          }
        }

        // Calculate line number
        const line = offsetToLineNumber(importNode.span.start, lineOffsets);

        imports.push({
          source,
          names,
          isTypeOnly,
          isDefault,
          isNamespace,
          line,
        });
      },
    });
  } catch {
    // Parse error - return empty array
    return [];
  }

  return imports;
}

/**
 * Extract only local imports (relative and alias)
 *
 * Filters out external package imports, keeping only:
 * - Relative imports: `./`, `../`
 * - Alias imports: `@/`, `~/`
 *
 * @param filePath - File path
 * @param content - Source code
 * @returns Array of local imports
 */
export function extractLocalImports(filePath: string, content: string): ImportInfo[] {
  return extractImports(filePath, content, { includeExternal: false });
}

/**
 * Extract import sources only (no names)
 *
 * Faster when you only need module specifiers.
 *
 * @param filePath - File path
 * @param content - Source code
 * @returns Array of module specifiers
 */
export function extractImportSources(filePath: string, content: string): string[] {
  const imports = extractImports(filePath, content);
  return imports.map((i) => i.source);
}

/**
 * Check if file imports from a specific module
 *
 * @param filePath - File path
 * @param content - Source code
 * @param modulePattern - Module to check (can be partial match)
 * @returns True if the file imports from the module
 *
 * @example
 * ```ts
 * if (hasImportFrom('app.tsx', code, 'react')) {
 *   console.log('File uses React');
 * }
 * ```
 */
export function hasImportFrom(filePath: string, content: string, modulePattern: string): boolean {
  const imports = extractImports(filePath, content);
  return imports.some((i) => i.source.includes(modulePattern));
}

/**
 * Get imported names from a specific module
 *
 * @param filePath - File path
 * @param content - Source code
 * @param moduleName - Exact module name to match
 * @returns Array of imported names
 *
 * @example
 * ```ts
 * const reactImports = getImportedNames('app.tsx', code, 'react');
 * // ['useState', 'useEffect']
 * ```
 */
export function getImportedNames(filePath: string, content: string, moduleName: string): string[] {
  const imports = extractImports(filePath, content);
  const match = imports.find((i) => i.source === moduleName);
  return match?.names ?? [];
}

/**
 * Convert offset to line number using line offsets array
 */
function offsetToLineNumber(offset: number, lineOffsets: number[]): number {
  for (let i = lineOffsets.length - 1; i >= 0; i--) {
    if (offset >= (lineOffsets[i] ?? 0)) {
      return i + 1;
    }
  }
  return 1;
}
