/**
 * @module commands/refactor/analyzers/core/swc-parser/function-extraction
 * @description Extract functions from TypeScript/JavaScript files using SWC
 */

import * as crypto from 'node:crypto';
import type {
  ArrowFunctionExpression,
  FunctionDeclaration,
  FunctionExpression,
  Node,
  Span,
} from '@swc/core';
import { offsetToPosition, parseFile } from '../../../../../lib/@ast/swc';
import type { SwcFunctionInfo, VisitContext } from './types';
import { visitNode } from './visitors';

/**
 * Extract functions from a TypeScript/JavaScript file using SWC
 */
export function extractFunctionsSwc(filePath: string, content: string): SwcFunctionInfo[] {
  const functions: SwcFunctionInfo[] = [];

  try {
    // Use parseFile from central @ast module which handles span offset normalization
    const { ast, lineOffsets, baseOffset } = parseFile(filePath, content);

    // Visit all nodes, passing baseOffset for span normalization
    visitNode(ast, (node, context) => {
      const funcInfo = extractFunctionInfo(
        node,
        filePath,
        content,
        lineOffsets,
        context,
        baseOffset,
      );
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
 * Extract function info from a node
 */
function extractFunctionInfo(
  node: Node,
  filePath: string,
  content: string,
  lineOffsets: number[],
  context: VisitContext,
  baseOffset: number,
): SwcFunctionInfo | null {
  const nodeType = (node as { type?: string }).type;

  if (nodeType === 'FunctionDeclaration') {
    const func = node as unknown as FunctionDeclaration;
    const name = func.identifier?.value ?? 'anonymous';
    return createFunctionInfo(
      func,
      name,
      filePath,
      content,
      lineOffsets,
      context.isExported,
      baseOffset,
    );
  }

  if (nodeType === 'FunctionExpression') {
    const func = node as unknown as FunctionExpression;
    const name = func.identifier?.value ?? 'anonymous';
    return createFunctionInfo(
      func,
      name,
      filePath,
      content,
      lineOffsets,
      context.isExported,
      baseOffset,
    );
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
    return createFunctionInfo(
      func,
      name,
      filePath,
      content,
      lineOffsets,
      context.isExported,
      baseOffset,
    );
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
  baseOffset: number,
): SwcFunctionInfo {
  const span = (func as { span?: Span }).span;
  // Normalize span using baseOffset, then convert SWC's 1-based to 0-based
  const start = Math.max(0, (span?.start ?? 1) - baseOffset - 1);
  const end = Math.min(content.length, (span?.end ?? content.length + 1) - baseOffset - 1);

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
