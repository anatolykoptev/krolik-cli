/**
 * @module lib/parsing/analysis/source-analyzer
 * @description Analyzes TypeScript source files to extract exported functions, classes, and their signatures
 *
 * Uses SWC for fast AST parsing (10-20x faster than ts-morph).
 */

import * as fs from 'node:fs';
import type {
  ClassDeclaration,
  ClassMember,
  ClassMethod,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Module,
  ModuleItem,
  Node,
  Param,
  Pattern,
  TsType,
  VariableDeclarator,
} from '@swc/core';
import {
  extractTypeString as swcExtractTypeString,
  parseFile as swcParseFile,
} from '@/lib/parsing/swc';
import {
  isArrowFunction,
  isAssignmentPattern,
  isClassDeclaration,
  isClassMethod,
  isExportDeclaration,
  isExportDefaultDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isTsEnum,
  isTsInterface,
  isTsTypeAlias,
  isVariableDeclaration,
} from './guards';
import type { ExportedMember, MethodInfo, ParamInfo, SourceAnalysisResult } from './types';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Analyze a source file and extract exported functions and classes
 *
 * @param filePath - Path to the source file
 * @param content - Optional file content (will read from disk if not provided)
 * @returns Analysis result with exported members
 *
 * @example
 * const result = analyzeSourceFile('/path/to/parser.ts');
 * if (result.success) {
 *   for (const exp of result.exports) {
 *     console.log(`${exp.kind}: ${exp.name}`);
 *   }
 * }
 */
export function analyzeSourceFile(filePath: string, content?: string): SourceAnalysisResult {
  try {
    const sourceContent = content ?? fs.readFileSync(filePath, 'utf-8');
    const { ast, baseOffset } = swcParseFile(filePath, sourceContent);
    const exports = extractExportedMembers(ast, sourceContent, baseOffset);

    return { success: true, exports };
  } catch (error) {
    return {
      success: false,
      exports: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract type as string from source content using span positions
 *
 * @deprecated Use `extractTypeString` from `@/lib/@swc` directly
 */
export function extractTypeString(typeNode: TsType, content: string, baseOffset = 0): string {
  return swcExtractTypeString(typeNode, content, baseOffset, 50);
}

// ============================================================================
// MEMBER BUILDER
// ============================================================================

interface FunctionMemberOptions {
  name: string;
  params: ParamInfo[];
  returnType?: string;
  isAsync: boolean;
  isDefault: boolean;
}

function buildFunctionMember(opts: FunctionMemberOptions): ExportedMember {
  const member: ExportedMember = {
    name: opts.name,
    kind: 'function',
    params: opts.params,
    isAsync: opts.isAsync,
    isDefault: opts.isDefault,
  };
  if (opts.returnType) member.returnType = opts.returnType;
  return member;
}

function buildClassMember(name: string, methods: MethodInfo[], isDefault: boolean): ExportedMember {
  return {
    name,
    kind: 'class',
    params: [],
    isAsync: false,
    isDefault,
    methods,
  };
}

// ============================================================================
// EXTRACTION
// ============================================================================

/**
 * Extract exported members from SWC AST
 *
 * @internal Use extractExports from @/lib/@ast for ts-morph based extraction
 */
function extractExportedMembers(
  ast: Module,
  content: string,
  baseOffset: number,
): ExportedMember[] {
  const exports: ExportedMember[] = [];

  for (const item of ast.body) {
    const extracted = extractFromModuleItem(item, content, baseOffset);
    if (extracted) exports.push(...extracted);
  }

  return exports;
}

function extractFromModuleItem(
  item: ModuleItem,
  content: string,
  baseOffset: number,
): ExportedMember[] | null {
  if (isExportDeclaration(item)) {
    return extractFromDeclaration(item.declaration as Node, content, baseOffset, false);
  }

  if (isExportDefaultDeclaration(item)) {
    return extractFromDeclaration(item.decl as Node, content, baseOffset, true);
  }

  return null;
}

function extractFromDeclaration(
  node: Node,
  content: string,
  baseOffset: number,
  isDefault: boolean,
): ExportedMember[] | null {
  // Function: export function foo() {} or export default function() {}
  if (isFunctionDeclaration(node)) {
    return [extractFunction(node, content, baseOffset, isDefault)];
  }

  if (isFunctionExpression(node)) {
    return [extractFunction(node, content, baseOffset, isDefault)];
  }

  // Class: export class Foo {}
  if (isClassDeclaration(node)) {
    return [extractClass(node, content, baseOffset, isDefault)];
  }

  // Variable: export const foo = () => {}
  if (isVariableDeclaration(node)) {
    return extractFromVariableDeclaration(node, content, baseOffset, isDefault);
  }

  // Type alias: export type Foo = { ... }
  if (isTsTypeAlias(node)) {
    return [extractTypeAlias(node, content, baseOffset)];
  }

  // Interface: export interface Bar { ... }
  if (isTsInterface(node)) {
    return [extractInterface(node, content, baseOffset)];
  }

  // Enum: export enum Baz { ... }
  if (isTsEnum(node)) {
    return [extractEnum(node)];
  }

  return null;
}

// ============================================================================
// FUNCTION EXTRACTION (unified for FunctionDeclaration + FunctionExpression)
// ============================================================================

function extractFunction(
  func: FunctionDeclaration | FunctionExpression,
  content: string,
  baseOffset: number,
  isDefault: boolean,
): ExportedMember {
  const returnType = extractReturnType(func.returnType, content, baseOffset);
  return buildFunctionMember({
    name: func.identifier?.value ?? 'default',
    params: extractParams(func.params ?? [], content, baseOffset),
    isAsync: func.async ?? false,
    isDefault,
    ...(returnType ? { returnType } : {}),
  });
}

function extractFromVariableDeclaration(
  varDecl: { declarations: VariableDeclarator[] },
  content: string,
  baseOffset: number,
  isDefault: boolean,
): ExportedMember[] {
  const members: ExportedMember[] = [];

  for (const declarator of varDecl.declarations) {
    const init = declarator.init;
    if (!init) continue;

    const name = isIdentifier(declarator.id) ? declarator.id.value : 'anonymous';

    // Arrow function
    if (isArrowFunction(init)) {
      const returnType = extractReturnType(init.returnType, content, baseOffset);
      members.push(
        buildFunctionMember({
          name,
          params: extractArrowParams(init.params ?? [], content, baseOffset),
          isAsync: init.async ?? false,
          isDefault,
          ...(returnType ? { returnType } : {}),
        }),
      );
      continue;
    }

    // Function expression
    if (isFunctionExpression(init)) {
      const returnType = extractReturnType(init.returnType, content, baseOffset);
      members.push(
        buildFunctionMember({
          name: name !== 'anonymous' ? name : (init.identifier?.value ?? 'anonymous'),
          params: extractParams(init.params ?? [], content, baseOffset),
          isAsync: init.async ?? false,
          isDefault,
          ...(returnType ? { returnType } : {}),
        }),
      );
    }
  }

  return members;
}

// ============================================================================
// CLASS EXTRACTION
// ============================================================================

function extractClass(
  cls: ClassDeclaration,
  content: string,
  baseOffset: number,
  isDefault: boolean,
): ExportedMember {
  return buildClassMember(
    cls.identifier?.value ?? 'default',
    extractClassMethods(cls.body ?? [], content, baseOffset),
    isDefault,
  );
}

function extractClassMethods(
  body: ClassMember[],
  content: string,
  baseOffset: number,
): MethodInfo[] {
  const methods: MethodInfo[] = [];

  for (const member of body) {
    if (!isClassMethod(member)) continue;

    const method = member as ClassMethod;
    if (!isIdentifier(method.key)) continue;

    const name = method.key.value;
    if (name.startsWith('#')) continue; // Skip private

    const info: MethodInfo = {
      name,
      params: extractParams(method.function?.params ?? [], content, baseOffset),
      isAsync: method.function?.async ?? false,
      isStatic: method.isStatic ?? false,
    };

    const returnType = extractReturnType(method.function?.returnType, content, baseOffset);
    if (returnType) info.returnType = returnType;

    methods.push(info);
  }

  return methods;
}

// ============================================================================
// PARAMETER EXTRACTION
// ============================================================================

function extractParams(params: Param[], content: string, baseOffset: number): ParamInfo[] {
  return params.map((p) => extractPatternParam(p.pat, content, baseOffset));
}

function extractArrowParams(params: Pattern[], content: string, baseOffset: number): ParamInfo[] {
  return params.map((p) => extractPatternParam(p, content, baseOffset));
}

function extractPatternParam(pat: Pattern, content: string, baseOffset: number): ParamInfo {
  // Simple identifier: (name: string)
  if (isIdentifier(pat)) {
    const typeAnnotation = (pat as unknown as { typeAnnotation?: { typeAnnotation?: TsType } })
      .typeAnnotation?.typeAnnotation;
    const typeStr = typeAnnotation
      ? extractTypeString(typeAnnotation, content, baseOffset)
      : undefined;

    return {
      name: pat.value,
      isOptional: (pat as Identifier & { optional?: boolean }).optional ?? false,
      hasDefault: false,
      ...(typeStr ? { type: typeStr } : {}),
    };
  }

  // Assignment pattern: (name = 'default')
  if (isAssignmentPattern(pat)) {
    const assign = pat as unknown as { left: Pattern };
    const leftName = isIdentifier(assign.left) ? assign.left.value : 'param';
    return { name: leftName, isOptional: true, hasDefault: true };
  }

  // Rest parameter: (...args)
  if ((pat as { type?: string }).type === 'RestElement') {
    const rest = pat as unknown as { argument: Pattern };
    const argName = isIdentifier(rest.argument) ? rest.argument.value : 'args';
    return { name: argName, type: 'unknown[]', isOptional: true, hasDefault: false };
  }

  // Object pattern: ({ a, b })
  if ((pat as { type?: string }).type === 'ObjectPattern') {
    return { name: 'options', type: 'object', isOptional: false, hasDefault: false };
  }

  // Array pattern: ([a, b])
  if ((pat as { type?: string }).type === 'ArrayPattern') {
    return { name: 'items', type: 'unknown[]', isOptional: false, hasDefault: false };
  }

  return { name: 'param', isOptional: false, hasDefault: false };
}

// ============================================================================
// TYPE/INTERFACE/ENUM EXTRACTION
// ============================================================================

function extractTypeAlias(node: Node, content: string, baseOffset: number): ExportedMember {
  const typeAlias = node as unknown as {
    id: Identifier;
    typeAnnotation: { span?: { start: number; end: number } };
  };

  const typeDef = extractSpanText(typeAlias.typeAnnotation, content, baseOffset);
  const member: ExportedMember = {
    name: typeAlias.id.value,
    kind: 'type',
    params: [],
    isAsync: false,
    isDefault: false,
  };
  if (typeDef) member.typeDefinition = typeDef;
  return member;
}

function extractInterface(node: Node, content: string, baseOffset: number): ExportedMember {
  const iface = node as unknown as {
    id: Identifier;
    body: { span?: { start: number; end: number } };
  };

  const typeDef = extractSpanText(iface.body, content, baseOffset);
  const member: ExportedMember = {
    name: iface.id.value,
    kind: 'interface',
    params: [],
    isAsync: false,
    isDefault: false,
  };
  if (typeDef) member.typeDefinition = typeDef;
  return member;
}

function extractEnum(node: Node): ExportedMember {
  const enumDecl = node as unknown as {
    id: Identifier;
    members: Array<{ id: Identifier }>;
  };

  const enumValues = enumDecl.members
    .map((m) => (isIdentifier(m.id) ? m.id.value : null))
    .filter((v): v is string => v !== null);

  return {
    name: enumDecl.id.value,
    kind: 'enum',
    params: [],
    isAsync: false,
    isDefault: false,
    enumValues,
  };
}

function extractSpanText(
  node: { span?: { start: number; end: number } } | undefined,
  content: string,
  baseOffset: number,
): string | undefined {
  if (!node?.span) return undefined;
  // Normalize span with baseOffset
  const start = node.span.start - baseOffset - 1;
  const end = node.span.end - baseOffset - 1;
  if (start < 0 || end > content.length || start >= end) return undefined;
  const text = content.slice(start, end).trim();
  return text.length > 100 ? `${text.slice(0, 97)}...` : text || undefined;
}

// ============================================================================
// HELPERS
// ============================================================================

function extractReturnType(
  returnType: { typeAnnotation?: TsType } | undefined,
  content: string,
  baseOffset: number,
): string | undefined {
  return returnType?.typeAnnotation
    ? extractTypeString(returnType.typeAnnotation, content, baseOffset)
    : undefined;
}
