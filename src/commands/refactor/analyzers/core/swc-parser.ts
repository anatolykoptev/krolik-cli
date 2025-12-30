/**
 * @module commands/refactor/analyzers/core/swc-parser
 * @description Fast SWC-based function extraction for refactor analysis
 *
 * Uses SWC for 10-20x faster AST parsing compared to ts-morph.
 * Performs syntax-only parsing (no type checking) for maximum speed.
 *
 * IMPORTANT: Uses parseFile from @ast/swc/parser to handle SWC's
 * accumulating span offsets correctly via baseOffset normalization.
 */

import * as crypto from 'node:crypto';
import type {
  ArrowFunctionExpression,
  FunctionDeclaration,
  FunctionExpression,
  Node,
  Span,
} from '@swc/core';
import { parseFile } from '../../../../lib/@ast/swc/parser';

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

export interface SwcTypeInfo {
  name: string;
  filePath: string;
  line: number;
  kind: 'interface' | 'type';
  isExported: boolean;
  /** Normalized structure for comparison */
  normalizedStructure: string;
  /** Field names (for interfaces) */
  fields: string[];
  /** Original definition text */
  definition: string;
}

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
 * Extract interfaces and type aliases from a TypeScript file using SWC
 */
export function extractTypesSwc(filePath: string, content: string): SwcTypeInfo[] {
  const types: SwcTypeInfo[] = [];

  try {
    // Use parseFile from central @ast module which handles span offset normalization
    const { ast, lineOffsets, baseOffset } = parseFile(filePath, content);

    visitNode(ast, (node, context) => {
      const typeInfo = extractTypeInfo(node, filePath, content, lineOffsets, context, baseOffset);
      if (typeInfo) {
        types.push(typeInfo);
      }
    });
  } catch {
    // Parse error - skip this file
  }

  return types;
}

/**
 * Extract type info from a node (interface or type alias)
 */
function extractTypeInfo(
  node: Node,
  filePath: string,
  content: string,
  lineOffsets: number[],
  context: VisitContext,
  baseOffset: number,
): SwcTypeInfo | null {
  const nodeType = (node as { type?: string }).type;

  if (nodeType === 'TsInterfaceDeclaration') {
    return extractInterfaceInfo(
      node,
      filePath,
      content,
      lineOffsets,
      context.isExported,
      baseOffset,
    );
  }

  if (nodeType === 'TsTypeAliasDeclaration') {
    return extractTypeAliasInfo(
      node,
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
 * Extract interface info
 */
function extractInterfaceInfo(
  node: Node,
  filePath: string,
  content: string,
  lineOffsets: number[],
  isExported: boolean,
  baseOffset: number,
): SwcTypeInfo | null {
  const iface = node as unknown as {
    id?: { value?: string };
    body?: { body?: Array<{ type?: string; key?: { value?: string }; typeAnnotation?: unknown }> };
    span?: Span;
  };

  const name = iface.id?.value;
  if (!name) return null;

  const span = iface.span;
  // Normalize span using baseOffset, then convert SWC's 1-based to 0-based
  const start = Math.max(0, (span?.start ?? 1) - baseOffset - 1);
  const end = Math.min(content.length, (span?.end ?? content.length + 1) - baseOffset - 1);
  const position = offsetToPosition(start, lineOffsets);

  // Extract field names
  const fields: string[] = [];
  const fieldDefs: string[] = [];

  for (const member of iface.body?.body ?? []) {
    if (member.type === 'TsPropertySignature' && member.key) {
      const propName = (member.key as { value?: string }).value;
      if (propName) {
        fields.push(propName);
        // Get type annotation text if available
        const typeText = extractTypeText(member.typeAnnotation, content, baseOffset);
        fieldDefs.push(`${propName}:${normalizeTypeText(typeText)}`);
      }
    } else if (member.type === 'TsMethodSignature' && member.key) {
      const methodName = (member.key as { value?: string }).value;
      if (methodName) {
        fields.push(methodName);
        fieldDefs.push(`${methodName}():unknown`);
      }
    }
  }

  fieldDefs.sort();
  const normalizedStructure = fieldDefs.join(';');
  const definition = content.slice(start, Math.min(end, start + 500));

  return {
    name,
    filePath,
    line: position.line,
    kind: 'interface',
    isExported,
    normalizedStructure,
    fields: fields.sort(),
    definition,
  };
}

/**
 * Extract type alias info
 */
function extractTypeAliasInfo(
  node: Node,
  filePath: string,
  content: string,
  lineOffsets: number[],
  isExported: boolean,
  baseOffset: number,
): SwcTypeInfo | null {
  const typeAlias = node as unknown as {
    id?: { value?: string };
    typeAnnotation?: unknown;
    span?: Span;
  };

  const name = typeAlias.id?.value;
  if (!name) return null;

  const span = typeAlias.span;
  // Normalize span using baseOffset, then convert SWC's 1-based to 0-based
  const start = Math.max(0, (span?.start ?? 1) - baseOffset - 1);
  const end = Math.min(content.length, (span?.end ?? content.length + 1) - baseOffset - 1);
  const position = offsetToPosition(start, lineOffsets);

  const typeText = extractTypeText(typeAlias.typeAnnotation, content, baseOffset);
  const normalizedStructure = normalizeTypeText(typeText);
  const definition = content.slice(start, Math.min(end, start + 500));

  return {
    name,
    filePath,
    line: position.line,
    kind: 'type',
    isExported,
    normalizedStructure,
    fields: [],
    definition,
  };
}

/**
 * Extract type text from type annotation node
 */
function extractTypeText(typeAnnotation: unknown, content: string, baseOffset: number): string {
  if (!typeAnnotation || typeof typeAnnotation !== 'object') return 'unknown';

  const span = (typeAnnotation as { span?: Span }).span;
  if (!span) return 'unknown';

  // Normalize span using baseOffset, then convert SWC's 1-based to 0-based
  const start = Math.max(0, span.start - baseOffset - 1);
  const end = Math.min(content.length, span.end - baseOffset - 1);
  return content.slice(start, end);
}

/**
 * Normalize type text for comparison
 */
function normalizeTypeText(typeText: string): string {
  return (
    typeText
      // Remove import paths
      .replace(/import\([^)]+\)\./g, '')
      // Remove whitespace
      .replace(/\s+/g, '')
      // Sort union/intersection members
      .split(/[|&]/)
      .map((t) => t.trim())
      .sort()
      .join('|')
  );
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
