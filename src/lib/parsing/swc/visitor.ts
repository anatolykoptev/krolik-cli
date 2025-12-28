/**
 * @module lib/parsing/swc/visitor
 * @description Generic visitor pattern for SWC AST traversal
 *
 * Provides a flexible visitor system for traversing and analyzing SWC ASTs
 * with support for specific node type callbacks.
 */

import type { Node } from '@swc/core';
import type { Position, VisitorCallback, VisitorCallbacks, VisitorContext } from './types';

/**
 * Calculate line offsets for position mapping
 *
 * Line offsets allow converting byte offsets to line/column positions.
 * Each offset marks the byte position where a new line starts.
 *
 * @param content - Source code content
 * @returns Array of byte offsets where lines start
 *
 * @example
 * const offsets = calculateLineOffsets("line1\nline2\nline3");
 * // Returns: [0, 6, 12] (line 1 at 0, line 2 at 6, line 3 at 12)
 */
export function calculateLineOffsets(content: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Convert byte offset to line/column position (1-indexed)
 *
 * @param offset - Byte offset in source code
 * @param lineOffsets - Pre-calculated line offsets
 * @returns Position with 1-indexed line and column
 *
 * @example
 * const offsets = calculateLineOffsets("line1\nline2");
 * const pos = offsetToPosition(6, offsets);
 * // Returns: { line: 2, column: 1 }
 */
export function offsetToPosition(offset: number, lineOffsets: number[]): Position {
  let line = 0;
  for (let i = 0; i < lineOffsets.length; i++) {
    if ((lineOffsets[i] ?? 0) > offset) {
      break;
    }
    line = i;
  }
  const column = offset - (lineOffsets[line] ?? 0);
  return { line: line + 1, column: column + 1 };
}

/**
 * Get the type name of a node
 *
 * @param node - AST node
 * @returns Type name string or 'Unknown' if not available
 */
export function getNodeType(node: Node): string {
  return (node as { type?: string }).type ?? 'Unknown';
}

/**
 * Visit all nodes in the AST with a callback
 *
 * This is a low-level visitor that calls the callback for every node.
 * For more structured visiting, use visitNodeWithCallbacks instead.
 *
 * @param node - Root node to start traversal
 * @param callback - Function called for each node
 * @param isExported - Whether current context is exported (internal)
 * @param parent - Parent node (internal)
 * @param depth - Current depth in tree (internal)
 * @param path - Path of node types from root (internal)
 *
 * @example
 * visitNode(ast, (node, context) => {
 *   if (context.isExported) {
 *     console.log('Found exported node:', getNodeType(node));
 *   }
 * });
 */
export function visitNode(
  node: Node,
  callback: VisitorCallback,
  isExported = false,
  parent?: Node,
  depth = 0,
  path: string[] = [],
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  // Check for export declarations
  const nodeType = getNodeType(node);
  let currentExported = isExported;

  if (nodeType === 'ExportDeclaration' || nodeType === 'ExportDefaultDeclaration') {
    currentExported = true;
  }

  // Build context
  const context: VisitorContext = {
    node,
    parent,
    isExported: currentExported,
    depth,
    path: [...path, nodeType],
  };

  // Call callback - if it returns false, stop traversing this branch
  const shouldContinue = callback(node, context);
  if (shouldContinue === false) {
    return;
  }

  // Visit children
  for (const key of Object.keys(node)) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          visitNode(item as Node, callback, currentExported, node, depth + 1, context.path);
        }
      }
    } else if (value && typeof value === 'object') {
      visitNode(value as Node, callback, currentExported, node, depth + 1, context.path);
    }
  }
}

/**
 * Visit AST nodes with typed callbacks for specific node types
 *
 * This is a higher-level visitor that dispatches to specific callbacks
 * based on node type. More convenient than visitNode for most use cases.
 *
 * @param node - Root node to start traversal
 * @param callbacks - Object with callbacks for specific node types
 *
 * @example
 * visitNodeWithCallbacks(ast, {
 *   onCallExpression: (node, context) => {
 *     console.log('Found function call at line', context.path);
 *   },
 *   onDebuggerStatement: (node, context) => {
 *     console.warn('Debugger statement at', context.path);
 *   },
 * });
 */
export function visitNodeWithCallbacks(node: Node, callbacks: VisitorCallbacks): void {
  visitNode(node, (n, context) => {
    const nodeType = getNodeType(n);

    // Try specific callback first
    const specificCallback = getCallbackForType(nodeType, callbacks);
    if (specificCallback) {
      return specificCallback(n, context);
    }

    // Fall back to general node callback
    if (callbacks.onNode) {
      return callbacks.onNode(n, context);
    }

    return undefined; // Continue traversal
  });
}

/**
 * Get the appropriate callback for a node type
 */
function getCallbackForType(
  nodeType: string,
  callbacks: VisitorCallbacks,
): VisitorCallback | undefined {
  switch (nodeType) {
    // Expression nodes
    case 'CallExpression':
      return callbacks.onCallExpression;
    case 'Identifier':
      return callbacks.onIdentifier;
    case 'NumericLiteral':
      return callbacks.onNumericLiteral;
    case 'StringLiteral':
      return callbacks.onStringLiteral;
    case 'MemberExpression':
      return callbacks.onMemberExpression;

    // TypeScript nodes
    case 'TsTypeAnnotation':
      return callbacks.onTsTypeAnnotation;
    case 'TsInterfaceDeclaration':
      return callbacks.onTsInterfaceDeclaration;
    case 'TsTypeAliasDeclaration':
      return callbacks.onTsTypeAliasDeclaration;
    case 'TsPropertySignature':
      return callbacks.onTsPropertySignature;

    // Statement nodes
    case 'DebuggerStatement':
      return callbacks.onDebuggerStatement;
    case 'ExportDeclaration':
    case 'ExportDefaultDeclaration':
      return callbacks.onExportDeclaration;
    case 'ImportDeclaration':
      return callbacks.onImportDeclaration;

    // Declaration nodes
    case 'VariableDeclaration':
      return callbacks.onVariableDeclaration;
    case 'FunctionDeclaration':
      return callbacks.onFunctionDeclaration;
    case 'FunctionExpression':
      return callbacks.onFunctionExpression;
    case 'ArrowFunctionExpression':
      return callbacks.onArrowFunctionExpression;

    // JSX nodes
    case 'JSXElement':
      return callbacks.onJSXElement;
    case 'JSXOpeningElement':
      return callbacks.onJSXOpeningElement;
    case 'JSXAttribute':
      return callbacks.onJSXAttribute;
    case 'JSXText':
      return callbacks.onJSXText;

    // Object/Array nodes
    case 'ObjectExpression':
      return callbacks.onObjectExpression;
    case 'KeyValueProperty':
      return callbacks.onKeyValueProperty;
    case 'ArrayExpression':
      return callbacks.onArrayExpression;

    default:
      return undefined;
  }
}

/**
 * Count nodes of specific types in an AST
 *
 * @param node - Root node
 * @param types - Array of node types to count
 * @returns Map of node type to count
 *
 * @example
 * const counts = countNodeTypes(ast, ['CallExpression', 'Identifier']);
 * console.log('Found', counts.get('CallExpression'), 'function calls');
 */
export function countNodeTypes(node: Node, types: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const t of types) {
    counts.set(t, 0);
  }

  visitNode(node, (n) => {
    const type = getNodeType(n);
    if (counts.has(type)) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  });

  return counts;
}

/**
 * Find all nodes of a specific type
 *
 * @param node - Root node
 * @param type - Node type to find
 * @returns Array of matching nodes
 *
 * @example
 * const debuggers = findNodesByType(ast, 'DebuggerStatement');
 * console.log('Found', debuggers.length, 'debugger statements');
 */
export function findNodesByType(node: Node, type: string): Node[] {
  const results: Node[] = [];

  visitNode(node, (n) => {
    if (getNodeType(n) === type) {
      results.push(n);
    }
  });

  return results;
}

/**
 * Convert byte offset to line number (1-indexed)
 *
 * Note: SWC uses 1-based byte offsets (first char is at offset 1)
 * Uses binary search for O(log n) performance.
 *
 * @param offset - Byte offset from SWC AST (1-based)
 * @param lineOffsets - Pre-calculated line offsets
 * @returns 1-indexed line number
 *
 * @example
 * const offsets = calculateLineOffsets("line1\nline2");
 * const line = offsetToLine(6, offsets); // Returns 2
 */
export function offsetToLine(offset: number, lineOffsets: number[]): number {
  // SWC offsets are 1-based, convert to 0-based for our calculation
  const zeroBasedOffset = offset - 1;

  // Binary search for efficiency
  let low = 0;
  let high = lineOffsets.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const currentOffset = lineOffsets[mid] ?? 0;
    const nextOffset = lineOffsets[mid + 1] ?? Number.MAX_SAFE_INTEGER;

    if (zeroBasedOffset >= currentOffset && zeroBasedOffset < nextOffset) {
      return mid + 1; // 1-based line numbers
    }

    if (zeroBasedOffset < currentOffset) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return 1; // Default to line 1
}

/**
 * Extract code snippet from content at given offset
 *
 * Returns the trimmed line content at the specified offset,
 * truncated to 80 characters.
 *
 * @param content - Source code content
 * @param offset - Byte offset from SWC AST (1-based)
 * @param lineOffsets - Pre-calculated line offsets
 * @returns Trimmed line content (max 80 chars)
 *
 * @example
 * const offsets = calculateLineOffsets(code);
 * const snippet = getSnippet(code, 42, offsets);
 * // Returns: "const x = 1;"
 */
export function getSnippet(content: string, offset: number, lineOffsets: number[]): string {
  const lineNum = offsetToLine(offset, lineOffsets) - 1;
  const lines = content.split('\n');
  const line = lines[lineNum] ?? '';
  return line.trim().slice(0, 80);
}

/**
 * Extract context string from content at position
 *
 * Similar to getSnippet but works with line start offset directly.
 *
 * @param content - Source code content
 * @param offset - Byte offset from SWC AST (1-based)
 * @param lineOffsets - Pre-calculated line offsets
 * @returns Trimmed line content (max 80 chars)
 */
export function getContext(content: string, offset: number, lineOffsets: number[]): string {
  const line = offsetToLine(offset, lineOffsets);
  const lineStart = lineOffsets[line - 1] ?? 0;

  // Find the actual line end (next newline or EOF)
  let lineEnd = content.indexOf('\n', lineStart);
  if (lineEnd === -1) {
    lineEnd = content.length;
  }
  const lineContent = content.slice(lineStart, lineEnd).trim();

  const MAX_CONTEXT_LENGTH = 80;
  return lineContent.slice(0, MAX_CONTEXT_LENGTH);
}
