/**
 * @module lib/ast
 * @description Centralized AST utilities using ts-morph
 *
 * This is the SINGLE source of truth for all AST operations.
 * All commands should import from here, never directly from ts-morph.
 *
 * RECOMMENDED: Use the pool API for memory-efficient operations:
 * - withSourceFile() - Auto-cleanup callback pattern (recommended)
 * - getProject() + releaseProject() - Manual management (advanced)
 *
 * LEGACY: Direct Project creation (deprecated, use pool instead):
 * - createProject() - Creates new Project instance (may leak memory)
 *
 * @example
 * // Recommended: Pool API with auto-cleanup
 * import { withSourceFile } from '@/lib/@ast';
 *
 * const count = withSourceFile(content, 'temp.ts', (sf) => {
 *   return sf.getFunctions().length;
 * });
 *
 * @example
 * // Advanced: Manual project management
 * import { getProject, releaseProject } from '@/lib/@ast';
 *
 * const project = getProject();
 * try {
 *   // ... use project
 * } finally {
 *   releaseProject(project);
 * }
 *
 * @example
 * // Legacy: Direct project creation (deprecated)
 * import { createProject, parseCode, extractImports } from '@/lib/@ast';
 *
 * const project = createProject();
 * const sourceFile = parseCode('const x = 1;');
 * const imports = extractImports(sourceFile);
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
export type { CodeContext, SyntaxError } from './analysis';
// Analysis utilities
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
export type {
  ExportInfo,
  FunctionInfo,
  ImportInfo,
  VariableUsage,
} from './extraction';
// Extraction utilities
export {
  extractExports,
  extractFunctions,
  extractImports,
  findDeclaredVariables,
  findModifiedVariables,
  findUsedVariables,
  getImportedModules,
} from './extraction';
export type { PoolOptions } from './pool';
// Pool API (RECOMMENDED)
export { astPool, disposePool, getProject, releaseProject, withSourceFile } from './pool';
export type { Position } from './position';
// Position utilities (utils layer - no dependencies)
export {
  calculateLineOffsets,
  getContext,
  getSnippet,
  offsetToLine,
  offsetToPosition,
} from './position';
export type { CreateProjectOptions, ParseFileOptions } from './project';
// Project and SourceFile utilities (LEGACY - use pool instead)
export {
  addFiles,
  createProject,
  createSourceFile,
  getScriptKind,
  getSourceFiles,
  parseCode,
} from './project';
