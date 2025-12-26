/**
 * @module lib/@ast-analysis/types
 * @description Type definitions for AST analysis utilities
 */

/**
 * Information about a function parameter
 */
export interface ParamInfo {
  name: string;
  type?: string;
  isOptional: boolean;
  hasDefault: boolean;
}

/**
 * Information about a class method
 */
export interface MethodInfo {
  name: string;
  params: ParamInfo[];
  returnType?: string;
  isAsync: boolean;
  isStatic: boolean;
}

/**
 * Information about an exported member (function or class)
 */
export interface ExportedMember {
  /** Name of the exported function/class */
  name: string;
  /** Type: function or class */
  kind: 'function' | 'class';
  /** Parameter names */
  params: ParamInfo[];
  /** Return type as string (if available) */
  returnType?: string;
  /** Whether the function is async */
  isAsync: boolean;
  /** Whether it's a default export */
  isDefault: boolean;
  /** For classes: methods info */
  methods?: MethodInfo[];
}

/**
 * Result of source file analysis
 */
export interface SourceAnalysisResult {
  /** Successfully parsed */
  success: boolean;
  /** Exported members found */
  exports: ExportedMember[];
  /** Error message if failed */
  error?: string;
}
