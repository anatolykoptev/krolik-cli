/**
 * @module commands/refactor/analyzers/core/swc-parser
 * @description Fast SWC-based function extraction for refactor analysis
 *
 * Uses SWC for 10-20x faster AST parsing compared to ts-morph.
 * Performs syntax-only parsing (no type checking) for maximum speed.
 */

import * as crypto from 'node:crypto';
import type { Node, Span } from '@swc/core';
import {
  type ArrowFunctionExpression,
  type FunctionDeclaration,
  type FunctionExpression,
  parseSync,
} from '@swc/core';

export interface SwcFunctionInfo {
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
 * Extract functions from a TypeScript/JavaScript file using SWC
 */
export function extractFunctionsSwc(filePath: string, content: string): SwcFunctionInfo[] {
  const functions: SwcFunctionInfo[] = [];

  try {
    const ast = parseSync(content, {
      syntax: 'typescript',
      tsx: filePath.endsWith('.tsx'),
    });

    // Calculate line offsets for position mapping
    const lineOffsets = calculateLineOffsets(content);

    // Visit all nodes
    visitNode(ast, (node, context) => {
      const funcInfo = extractFunctionInfo(node, filePath, content, lineOffsets, context);
      if (funcInfo) {
        functions.push(funcInfo);
      }
    });
  } catch {
    // Parse error - skip this file
  }

  return functions;
}

/**
 * Calculate line offsets for position mapping
 */
function calculateLineOffsets(content: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Convert byte offset to line/column
 */
function offsetToPosition(offset: number, lineOffsets: number[]): { line: number; column: number } {
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
 * Context for visiting nodes - tracks parent info for arrow function naming
 */
interface VisitContext {
  isExported: boolean;
  /** Variable name if inside a VariableDeclarator */
  variableName?: string | undefined;
}

/**
 * Visit all nodes in the AST
 */
function visitNode(
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

  // Clear variable name when entering object/array literals
  // This prevents arrow functions inside objects from inheriting the parent variable name
  // e.g., `const format = { debug: () => ... }` - the arrow function should NOT be named "format"
  if (nodeType === 'ObjectExpression' || nodeType === 'ArrayExpression') {
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

/**
 * Extract function info from a node
 */
function extractFunctionInfo(
  node: Node,
  filePath: string,
  content: string,
  lineOffsets: number[],
  context: VisitContext,
): SwcFunctionInfo | null {
  const nodeType = (node as { type?: string }).type;

  if (nodeType === 'FunctionDeclaration') {
    const func = node as unknown as FunctionDeclaration;
    const name = func.identifier?.value ?? 'anonymous';
    return createFunctionInfo(func, name, filePath, content, lineOffsets, context.isExported);
  }

  if (nodeType === 'FunctionExpression') {
    const func = node as unknown as FunctionExpression;
    const name = func.identifier?.value ?? 'anonymous';
    return createFunctionInfo(func, name, filePath, content, lineOffsets, context.isExported);
  }

  if (nodeType === 'ArrowFunctionExpression') {
    const func = node as unknown as ArrowFunctionExpression;
    // Use variable name from parent VariableDeclarator, skip if not found
    // This prevents false positives from anonymous arrow functions
    const name = context.variableName;
    if (!name) {
      // Skip anonymous arrow functions (callbacks, inline functions, etc.)
      return null;
    }
    return createFunctionInfo(func, name, filePath, content, lineOffsets, context.isExported);
  }

  return null;
}

/**
 * Create function info from parsed function node
 */
function createFunctionInfo(
  func: FunctionDeclaration | FunctionExpression | ArrowFunctionExpression,
  name: string,
  filePath: string,
  content: string,
  lineOffsets: number[],
  isExported: boolean,
): SwcFunctionInfo {
  const span = (func as { span?: Span }).span;
  const start = span?.start ?? 0;
  const end = span?.end ?? content.length;

  const position = offsetToPosition(start, lineOffsets);
  const bodyContent = content.slice(start, end);
  const bodyHash = crypto.createHash('md5').update(bodyContent).digest('hex');

  const params = (func as { params?: unknown[] }).params ?? [];

  return {
    name,
    filePath,
    line: position.line,
    column: position.column,
    bodyHash,
    paramCount: params.length,
    isAsync: (func as { async?: boolean }).async ?? false,
    isExported,
    bodyStart: start,
    bodyEnd: end,
  };
}
