/**
 * @module commands/refactor/analyzers/core/swc-parser/types
 * @description Type definitions for SWC-based parsing
 */

/**
 * Function information extracted from SWC AST
 */
export interface SwcFunctionInfo {
  name: string;
  filePath: string;
  line: number;
  column: number;
  bodyHash: string;
  paramCount: number;
  isAsync: boolean;
  isExported: boolean;
  /** Start offset of function body in source */
  bodyStart: number;
  /** End offset of function body in source */
  bodyEnd: number;
}

/**
 * Type information extracted from SWC AST (interface or type alias)
 */
export interface SwcTypeInfo {
  name: string;
  filePath: string;
  line: number;
  kind: 'interface' | 'type';
  isExported: boolean;
  /** Normalized structure for comparison */
  normalizedStructure: string;
  /** Field names (for interfaces) */
  fields: string[];
  /** Original definition text */
  definition: string;
}

/**
 * Context for visiting nodes - tracks parent info for arrow function naming
 */
export interface VisitContext {
  isExported: boolean;
  /** Variable name if inside a VariableDeclarator */
  variableName?: string | undefined;
}
