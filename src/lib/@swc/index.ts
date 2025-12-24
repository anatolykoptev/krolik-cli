/**
 * @module lib/@swc
 * @description Shared SWC AST infrastructure for fast TypeScript/JavaScript parsing
 *
 * This is the centralized module for all SWC-based AST operations in Krolik CLI.
 * Provides:
 * - Fast parsing with caching (10-20x faster than ts-morph)
 * - Generic visitor pattern for AST traversal
 * - Utility functions for position mapping and node inspection
 * - Type-safe interfaces for analysis results
 *
 * RECOMMENDED: Use the cached parser for file analysis:
 *
 * @example
 * // Parse with caching
 * import { parseFile, visitNodeWithCallbacks } from '@/lib/@swc';
 *
 * const { ast, lineOffsets } = parseFile('src/app.ts', sourceCode);
 *
 * // Visit specific node types
 * visitNodeWithCallbacks(ast, {
 *   onDebuggerStatement: (node, context) => {
 *     console.log('Debugger at line', context.path);
 *   },
 *   onCallExpression: (node, context) => {
 *     // Analyze function calls
 *   },
 * });
 *
 * @example
 * // Low-level visitor
 * import { parseFile, visitNode, getNodeType } from '@/lib/@swc';
 *
 * const { ast } = parseFile('src/app.ts', code);
 * visitNode(ast, (node, context) => {
 *   if (context.isExported) {
 *     console.log('Exported:', getNodeType(node));
 *   }
 * });
 *
 * @example
 * // Validate syntax
 * import { validateSyntax } from '@/lib/@swc';
 *
 * const result = validateSyntax('test.ts', 'const x = 1;');
 * if (result.success) {
 *   // Work with result.ast
 * }
 */

// Re-export SWC types that are commonly needed
export type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Module,
  Node,
  NumericLiteral,
  Span,
  Statement,
  StringLiteral,
  TsType,
} from '@swc/core';

// Export types
export type {
  CacheEntry,
  FunctionInfo,
  ParseOptions,
  Position,
  PositionRange,
  Range,
  VisitorCallback,
  VisitorCallbacks,
  VisitorContext,
  VisitorResult,
} from './types';

// Export parser functions
export {
  clearCache,
  getCacheStats,
  getNodeSpan,
  getNodeText,
  parseFile,
  parseFileUncached,
  validateSyntax,
} from './parser';

// Export visitor functions
export {
  calculateLineOffsets,
  countNodeTypes,
  findNodesByType,
  getNodeType,
  offsetToPosition,
  visitNode,
  visitNodeWithCallbacks,
} from './visitor';
