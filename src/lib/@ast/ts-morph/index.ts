/**
 * @module lib/@ast/ts-morph
 * @description Centralized AST utilities using ts-morph
 *
 * This is the SINGLE source of truth for all ts-morph AST operations.
 * Use the pool API for memory-efficient operations.
 *
 * @example
 * ```typescript
 * import { withSourceFile } from '@/lib/@ast/ts-morph';
 *
 * const count = withSourceFile(content, 'temp.ts', (sf) => {
 *   return sf.getFunctions().length;
 * });
 * ```
 */

// Re-export ts-morph types that are commonly needed
export {
  DiagnosticCategory,
  Node,
  Project,
  ScriptKind,
  SourceFile,
  SyntaxKind,
} from 'ts-morph';

// Analysis utilities
export type { CodeContext, SyntaxError } from './analysis';
export {
  findAncestor,
  findAncestorWhere,
  getCodeContext,
  getContainingFunctionBody,
  getDescendants,
  getLineRange,
  getSyntaxErrors,
  hasValidSyntax,
  isInsideArray,
  isInsideComment,
  isInsideConstObject,
  isInsideFunction,
  isInsideString,
} from './analysis';

// Extraction utilities
export type {
  ExportInfo,
  FunctionInfo,
  ImportInfo,
  VariableUsage,
} from './extraction';
export {
  extractExports,
  extractFunctions,
  extractImports,
  findDeclaredVariables,
  findModifiedVariables,
  findUsedVariables,
  getImportedModules,
} from './extraction';

// Pool API (RECOMMENDED)
export type { PoolOptions } from './pool';
export { astPool, disposePool, getProject, releaseProject, withSourceFile } from './pool';

// Position utilities
export type { Position } from './position';
export {
  calculateLineOffsets,
  getContext,
  getSnippet,
  offsetToLine,
  offsetToPosition,
} from './position';

// Project utilities (LEGACY - use pool instead)
export type { CreateProjectOptions, ParseFileOptions } from './project';
export {
  addFiles,
  createProject,
  createSourceFile,
  getScriptKind,
  getSourceFiles,
  parseCode,
} from './project';
