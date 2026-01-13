/**
 * @module commands/refactor/analyzers/core/swc-parser/type-extraction
 * @description Extract interfaces and type aliases from TypeScript files using SWC
 */

import type { Node, Span } from '@swc/core';
import { offsetToPosition, parseFile } from '../../../../../lib/@ast/swc';
import { extractTypeText, normalizeTypeText } from './shared';
import type { SwcTypeInfo, VisitContext } from './types';
import { visitNode } from './visitors';

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
