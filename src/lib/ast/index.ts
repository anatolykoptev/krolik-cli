/**
 * @module lib/ast
 * @description Centralized AST utilities using ts-morph
 *
 * This is the SINGLE source of truth for all AST operations.
 * All commands should import from here, never directly from ts-morph.
 *
 * @example
 * import { createProject, parseCode, extractImports } from '@/lib/ast';
 *
 * const project = createProject();
 * const sourceFile = parseCode('const x = 1;');
 * const imports = extractImports(sourceFile);
 */

// Re-export ts-morph types that are commonly needed
export {
  Project,
  SourceFile,
  Node,
  SyntaxKind,
  ScriptKind,
  DiagnosticCategory,
} from 'ts-morph';

// Project and SourceFile utilities
export {
  createProject,
  createSourceFile,
  parseCode,
  getScriptKind,
  addFiles,
  getSourceFiles,
} from './project';
export type { CreateProjectOptions, ParseFileOptions } from './project';

// Analysis utilities
export {
  findAncestor,
  findAncestorWhere,
  getDescendants,
  isInsideString,
  isInsideComment,
  isInsideConstObject,
  isInsideArray,
  isInsideFunction,
  getCodeContext,
  hasValidSyntax,
  getSyntaxErrors,
  getContainingFunctionBody,
  getLineRange,
} from './analysis';
export type { CodeContext, SyntaxError } from './analysis';

// Extraction utilities
export {
  extractImports,
  getImportedModules,
  extractExports,
  extractFunctions,
  findUsedVariables,
  findDeclaredVariables,
  findModifiedVariables,
} from './extraction';
export type {
  ImportInfo,
  ExportInfo,
  FunctionInfo,
  VariableUsage,
} from './extraction';
