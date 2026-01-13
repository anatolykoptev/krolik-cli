/**
 * @module commands/refactor/analyzers/core/swc-parser/visitors
 * @description AST visitor pattern for traversing SWC parse trees
 */

import type { Node } from '@swc/core';
import type { VisitContext } from './types';

/**
 * Visit all nodes in the AST with context tracking
 *
 * Tracks:
 * - Export declarations (isExported)
 * - Variable names for arrow function naming
 * - Clears variable names for nested contexts (objects, arrays, calls)
 */
export function visitNode(
  node: Node,
  callback: (node: Node, context: VisitContext) => void,
  context: VisitContext = { isExported: false },
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  // Check for export declarations
  const nodeType = (node as { type?: string }).type;
  const currentContext = { ...context };

  if (nodeType === 'ExportDeclaration' || nodeType === 'ExportDefaultDeclaration') {
    currentContext.isExported = true;
  }

  // Track variable name for arrow functions
  if (nodeType === 'VariableDeclarator') {
    const decl = node as unknown as { id?: { type?: string; value?: string } };
    if (decl.id?.type === 'Identifier' && decl.id.value) {
      currentContext.variableName = decl.id.value;
    }
  }

  // Clear variable name when entering object/array literals or call expressions
  // This prevents arrow functions inside objects/calls from inheriting the parent variable name
  // e.g., `const format = { debug: () => ... }` - the arrow function should NOT be named "format"
  // e.g., `const files = arr.filter((f) => ...)` - the callback should NOT be named "files"
  if (
    nodeType === 'ObjectExpression' ||
    nodeType === 'ArrayExpression' ||
    nodeType === 'CallExpression'
  ) {
    currentContext.variableName = undefined;
  }

  callback(node, currentContext);

  // Visit children
  for (const key of Object.keys(node)) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          visitNode(item as Node, callback, currentContext);
        }
      }
    } else if (value && typeof value === 'object') {
      visitNode(value as Node, callback, currentContext);
    }
  }
}
