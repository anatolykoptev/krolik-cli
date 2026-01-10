/**
 * @module lib/@ast/swc/types
 * @description Shared types for SWC AST analysis
 */

import type { Node } from '@swc/core';

// Import and re-export Position from @ast (utils layer)
import type { Position } from '@/lib/@ast';
export type { Position };

/**
 * Range in source code with byte offsets
 */
export interface Range {
  start: number;
  end: number;
}

/**
 * Position range with line/column info
 */
export interface PositionRange {
  start: Position;
  end: Position;
}

/**
 * Function information extracted from AST
 */
export interface FunctionInfo {
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
 * Generic visitor callback for AST nodes
 * Returns false to stop traversing this branch, void/undefined to continue
 */
// biome-ignore lint/suspicious/noConfusingVoidType: void is intentional for callbacks that don't return
export type VisitorCallback = (node: Node, context?: VisitorContext) => void | boolean;

/**
 * Context passed to visitor callbacks
 */
export interface VisitorContext {
  /** Current node being visited */
  node: Node;
  /** Parent node (if any) */
  parent: Node | undefined;
  /** Whether current node is in an exported declaration */
  isExported: boolean;
  /** Depth in the AST tree */
  depth: number;
  /** Path of node types from root to current node */
  path: string[];
}

/**
 * Visitor callbacks for specific node types
 */
export interface VisitorCallbacks {
  /** Called for all nodes (if no specific handler) */
  onNode?: VisitorCallback;
  /** Called for CallExpression nodes */
  onCallExpression?: VisitorCallback;
  /** Called for Identifier nodes */
  onIdentifier?: VisitorCallback;
  /** Called for NumericLiteral nodes */
  onNumericLiteral?: VisitorCallback;
  /** Called for StringLiteral nodes */
  onStringLiteral?: VisitorCallback;
  /** Called for TsTypeAnnotation nodes */
  onTsTypeAnnotation?: VisitorCallback;
  /** Called for DebuggerStatement nodes */
  onDebuggerStatement?: VisitorCallback;
  /** Called for ExportDeclaration nodes */
  onExportDeclaration?: VisitorCallback;
  /** Called for ImportDeclaration nodes */
  onImportDeclaration?: VisitorCallback;
  /** Called for VariableDeclaration nodes */
  onVariableDeclaration?: VisitorCallback;
  /** Called for FunctionDeclaration nodes */
  onFunctionDeclaration?: VisitorCallback;
  /** Called for FunctionExpression nodes */
  onFunctionExpression?: VisitorCallback;
  /** Called for ArrowFunctionExpression nodes */
  onArrowFunctionExpression?: VisitorCallback;

  // === TypeScript declaration nodes ===
  /** Called for TsInterfaceDeclaration nodes */
  onTsInterfaceDeclaration?: VisitorCallback;
  /** Called for TsTypeAliasDeclaration nodes */
  onTsTypeAliasDeclaration?: VisitorCallback;
  /** Called for TsPropertySignature (interface properties) */
  onTsPropertySignature?: VisitorCallback;

  // === JSX nodes ===
  /** Called for JSXElement nodes */
  onJSXElement?: VisitorCallback;
  /** Called for JSXOpeningElement nodes */
  onJSXOpeningElement?: VisitorCallback;
  /** Called for JSXAttribute nodes */
  onJSXAttribute?: VisitorCallback;
  /** Called for JSXText nodes */
  onJSXText?: VisitorCallback;

  // === Object/Array nodes ===
  /** Called for ObjectExpression nodes */
  onObjectExpression?: VisitorCallback;
  /** Called for KeyValueProperty (object properties) */
  onKeyValueProperty?: VisitorCallback;
  /** Called for ArrayExpression nodes */
  onArrayExpression?: VisitorCallback;

  // === Member access ===
  /** Called for MemberExpression nodes */
  onMemberExpression?: VisitorCallback;

  // === Control flow nodes (for simplify analysis) ===
  /** Called for IfStatement nodes */
  onIfStatement?: VisitorCallback;
  /** Called for SwitchStatement nodes */
  onSwitchStatement?: VisitorCallback;
  /** Called for SwitchCase nodes */
  onSwitchCase?: VisitorCallback;
  /** Called for ReturnStatement nodes */
  onReturnStatement?: VisitorCallback;
  /** Called for ThrowStatement nodes */
  onThrowStatement?: VisitorCallback;
  /** Called for BreakStatement nodes */
  onBreakStatement?: VisitorCallback;
  /** Called for ContinueStatement nodes */
  onContinueStatement?: VisitorCallback;
  /** Called for BlockStatement nodes */
  onBlockStatement?: VisitorCallback;

  // === Expression nodes (for simplify analysis) ===
  /** Called for ConditionalExpression (ternary) nodes */
  onConditionalExpression?: VisitorCallback;
  /** Called for BinaryExpression nodes */
  onBinaryExpression?: VisitorCallback;
  /** Called for UnaryExpression nodes */
  onUnaryExpression?: VisitorCallback;
  /** Called for TemplateLiteral nodes */
  onTemplateLiteral?: VisitorCallback;
}

/**
 * Options for parsing files
 */
export interface ParseOptions {
  /** Syntax type (default: 'typescript') */
  syntax?: 'typescript' | 'ecmascript';
  /** Enable TSX parsing (auto-detected from file extension if not specified) */
  tsx?: boolean;
  /** Enable JSX parsing */
  jsx?: boolean;
  /** Target ECMAScript version */
  target?:
    | 'es5'
    | 'es2015'
    | 'es2016'
    | 'es2017'
    | 'es2018'
    | 'es2019'
    | 'es2020'
    | 'es2021'
    | 'es2022';
}

/**
 * Cache entry for parsed AST
 */
export interface CacheEntry {
  /** Parsed AST module */
  ast: Node;
  /** Line offsets for position mapping */
  lineOffsets: number[];
  /** File content hash (for invalidation) */
  contentHash: string;
  /** Timestamp of last access */
  lastAccess: number;
  /**
   * Base offset for span normalization.
   * SWC accumulates spans globally, so we need to subtract this
   * from all span.start/end values to get correct 1-based offsets.
   */
  baseOffset: number;
}

/**
 * Result of a visitor traversal
 */
export interface VisitorResult<T = unknown> {
  /** Collected data during traversal */
  data: T;
  /** Number of nodes visited */
  nodeCount: number;
  /** Time taken in milliseconds */
  duration?: number;
}
