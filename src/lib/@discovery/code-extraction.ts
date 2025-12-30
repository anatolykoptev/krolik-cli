/**
 * @module lib/@discovery/code-extraction
 * @description Simple regex-based code extraction utilities
 *
 * Fast utilities for extracting exports/imports from source code
 * without full AST parsing. Use for display/reporting purposes.
 *
 * For full AST-based analysis, use @/lib/@ast instead.
 */

// ============================================================================
// EXPORTS EXTRACTION
// ============================================================================

/**
 * Extract export names from source code using regex
 *
 * @param content - Source code content
 * @returns Array of unique export names
 *
 * @example
 * ```ts
 * const exports = extractExportNames('export const foo = 1; export function bar() {}');
 * // => ['foo', 'bar']
 * ```
 */
export function extractExportNames(content: string): string[] {
  const exports: string[] = [];

  // Match: export const/function/class/type/interface/enum Name
  const declarationRegex = /export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g;

  // Match: export { name1, name2 as alias }
  const namedExportRegex = /export\s*\{([^}]+)\}/g;

  let match;

  // Extract declaration exports
  while ((match = declarationRegex.exec(content)) !== null) {
    if (match[1]) exports.push(match[1]);
  }

  // Extract named exports
  while ((match = namedExportRegex.exec(content)) !== null) {
    if (match[1]) {
      const names = match[1].split(',').map((s) => {
        // Handle "name as alias" - take the original name
        const trimmed = s.trim();
        const asMatch = trimmed.match(/^(\w+)\s+as\s+/);
        return asMatch?.[1] ?? trimmed.split(/\s+/)[0] ?? '';
      });
      exports.push(...names.filter((n): n is string => !!n && n !== 'type'));
    }
  }

  return [...new Set(exports)];
}

// ============================================================================
// IMPORTS EXTRACTION
// ============================================================================

/**
 * Extract import module paths from source code using regex
 *
 * @param content - Source code content
 * @returns Array of unique import paths
 *
 * @example
 * ```ts
 * const imports = extractImportPaths('import { foo } from "./bar"; import x from "lodash"');
 * // => ['./bar', 'lodash']
 * ```
 */
export function extractImportPaths(content: string): string[] {
  const imports: string[] = [];

  // Match: import ... from 'module' or import ... from "module"
  const importRegex =
    /import\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+)?\s*(?:,\s*\{[^}]*\})?\s*from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) imports.push(match[1]);
  }

  return [...new Set(imports)];
}

// ============================================================================
// COMBINED EXTRACTION
// ============================================================================

/**
 * Extract both exports and imports from source code
 */
export function extractCodeStructure(content: string): {
  exports: string[];
  imports: string[];
} {
  return {
    exports: extractExportNames(content),
    imports: extractImportPaths(content),
  };
}
