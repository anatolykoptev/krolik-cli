/**
 * @module commands/refactor/analyzers/swc-parser
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
    visitNode(ast, (node, isExported) => {
      const funcInfo = extractFunctionInfo(node, filePath, content, lineOffsets, isExported);
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
 * Visit all nodes in the AST
 */
function visitNode(
  node: Node,
  callback: (node: Node, isExported: boolean) => void,
  isExported = false,
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  // Check for export declarations
  const nodeType = (node as { type?: string }).type;
  let currentExported = isExported;

  if (nodeType === 'ExportDeclaration' || nodeType === 'ExportDefaultDeclaration') {
    currentExported = true;
  }

  callback(node, currentExported);

  // Visit children
  for (const key of Object.keys(node)) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          visitNode(item as Node, callback, currentExported);
        }
      }
    } else if (value && typeof value === 'object') {
      visitNode(value as Node, callback, currentExported);
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
  isExported: boolean,
): SwcFunctionInfo | null {
  const nodeType = (node as { type?: string }).type;

  if (nodeType === 'FunctionDeclaration') {
    const func = node as unknown as FunctionDeclaration;
    const name = func.identifier?.value ?? 'anonymous';
    return createFunctionInfo(func, name, filePath, content, lineOffsets, isExported);
  }

  if (nodeType === 'FunctionExpression') {
    const func = node as unknown as FunctionExpression;
    const name = func.identifier?.value ?? 'anonymous';
    return createFunctionInfo(func, name, filePath, content, lineOffsets, isExported);
  }

  if (nodeType === 'ArrowFunctionExpression') {
    const func = node as unknown as ArrowFunctionExpression;
    // Arrow functions are usually assigned to variables, we'll get name from parent
    return createFunctionInfo(func, 'arrow', filePath, content, lineOffsets, isExported);
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
