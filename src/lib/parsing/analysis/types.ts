/**
 * @module lib/parsing/analysis/types
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
 * Kind of exported member
 */
export type ExportKind = 'function' | 'class' | 'type' | 'interface' | 'enum' | 'const';

/**
 * Information about an exported member
 */
export interface ExportedMember {
  /** Name of the exported function/class/type */
  name: string;
  /** Kind of export */
  kind: ExportKind;
  /** Parameter names (for functions) */
  params: ParamInfo[];
  /** Return type as string (if available) */
  returnType?: string;
  /** Whether the function is async */
  isAsync: boolean;
  /** Whether it's a default export */
  isDefault: boolean;
  /** For classes: methods info */
  methods?: MethodInfo[];
  /** For enums: enum values */
  enumValues?: string[];
  /** For types/interfaces: the type definition as string */
  typeDefinition?: string;
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
