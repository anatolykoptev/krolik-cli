/**
 * @module lib/@ast/swc
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
 * import { parseFile, visitNodeWithCallbacks } from '@/lib/@ast/swc';
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
 * import { parseFile, visitNode, getNodeType } from '@/lib/@ast/swc';
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
 * import { validateSyntax } from '@/lib/@ast/swc';
 *
 * const result = validateSyntax('test.ts', 'const x = 1;');
 * if (result.success) {
 *   // Work with result.ast
 * }
 *
 * @example
 * // Extract information from nodes
 * import { getCalleeName, collectMethodChain, extractStringArg } from '@/lib/@ast/swc';
 *
 * visitNodeWithCallbacks(ast, {
 *   onCallExpression: (node) => {
 *     const call = node as unknown as CallExpression;
 *
 *     // Extract function name
 *     const name = getCalleeName(call); // 'register'
 *
 *     // Extract string argument
 *     const fieldName = extractStringArg(call); // 'email'
 *
 *     // Collect method chain for Zod schemas
 *     const methods = collectMethodChain(call); // ['string', 'min', 'max']
 *   },
 * });
 *
 * @example
 * // Check string/comment context (no AST needed)
 * import { isInsideString, isInsideComment, isInsideStringOrComment } from '@/lib/@ast/swc';
 *
 * const code = 'const x = "hello"; // greeting';
 *
 * isInsideString(code, 12);          // true - inside "hello"
 * isInsideComment(code, 25);         // true - inside comment
 * isInsideStringOrComment(code, 12); // true - combined check
 */

// Re-export SWC types that are commonly needed
export type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  JSXAttribute,
  JSXOpeningElement,
  MemberExpression,
  Module,
  Node,
  NumericLiteral,
  Span,
  Statement,
  StringLiteral,
  TsType,
} from '@swc/core';

// Export extractor utilities
export {
  collectMethodChain,
  extractAllStringArgs,
  extractStringArg,
  extractTypeString,
  getCalleeName,
  getCalleeObjectName,
  getIdentifierName,
  getJSXAttributeValue,
  getJSXElementName,
  getRootObjectName,
  isCallingFunction,
  isCallingMethod,
} from './extractors';
export type { ImportInfo } from './imports';
// Export import extraction utilities (fast alternative to regex)
export {
  extractImportSources,
  extractImports,
  extractLocalImports,
  getImportedNames,
  hasImportFrom,
} from './imports';

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
// Export string/comment context detection utilities
export {
  getLineContent,
  getLineNumber,
  isInsideComment,
  isInsideLineComment,
  isInsideString,
  isInsideStringLine,
  isInsideStringOrComment,
} from './string-context';
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
// Export visitor functions
export {
  calculateLineOffsets,
  countNodeTypes,
  findNodesByType,
  getContext,
  getNodeType,
  getSnippet,
  offsetToLine,
  offsetToPosition,
  visitNode,
  visitNodeWithCallbacks,
} from './visitor';
