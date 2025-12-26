/**
 * @module lib/@ast-analysis/source-analyzer
 * @description Analyzes TypeScript source files to extract exported functions, classes, and their signatures
 *
 * Uses SWC for fast AST parsing (10-20x faster than ts-morph).
 */

import * as fs from 'node:fs';
import type {
  ArrowFunctionExpression,
  ClassDeclaration,
  ClassMember,
  ClassMethod,
  ExportDeclaration,
  ExportDefaultDeclaration,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Module,
  ModuleItem,
  Node,
  Param,
  Pattern,
  TsType,
  VariableDeclaration,
  VariableDeclarator,
} from '@swc/core';
import { parseFile as swcParseFile } from '@/lib/@swc';
import type { ExportedMember, MethodInfo, ParamInfo, SourceAnalysisResult } from './types';

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
    const { ast } = swcParseFile(filePath, sourceContent);

    const exports = extractExports(ast, sourceContent);

    return {
      success: true,
      exports,
    };
  } catch (error) {
    return {
      success: false,
      exports: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Extract all exports from the module AST
 */
function extractExports(ast: Module, content: string): ExportedMember[] {
  const exports: ExportedMember[] = [];

  for (const item of ast.body) {
    const exported = extractExportedMember(item, content);
    if (exported) {
      exports.push(...exported);
    }
  }

  return exports;
}

/**
 * Extract exported member from a module item
 */
function extractExportedMember(item: ModuleItem, content: string): ExportedMember[] | null {
  const itemType = (item as { type?: string }).type;

  // Handle: export function foo() {}
  if (itemType === 'ExportDeclaration') {
    const exportDecl = item as unknown as ExportDeclaration;
    return extractFromDeclaration(exportDecl.declaration as Node, content, false);
  }

  // Handle: export default function() {} or export default class {}
  if (itemType === 'ExportDefaultDeclaration') {
    const defaultExport = item as unknown as ExportDefaultDeclaration;
    const decl = defaultExport.decl as Node;
    return extractFromDeclaration(decl, content, true);
  }

  return null;
}

/**
 * Extract member info from a declaration node
 */
function extractFromDeclaration(
  node: Node,
  content: string,
  isDefault: boolean,
): ExportedMember[] | null {
  const nodeType = (node as { type?: string }).type;

  // Function declaration: export function foo() {}
  if (nodeType === 'FunctionDeclaration') {
    const func = node as unknown as FunctionDeclaration;
    const member = extractFunctionMember(func, content, isDefault);
    return member ? [member] : null;
  }

  // Function expression: export default function() {}
  if (nodeType === 'FunctionExpression') {
    const func = node as unknown as FunctionExpression;
    const member = extractFunctionExpressionMember(func, content, isDefault);
    return member ? [member] : null;
  }

  // Class declaration: export class Foo {}
  if (nodeType === 'ClassDeclaration') {
    const cls = node as unknown as ClassDeclaration;
    const member = extractClassMember(cls, content, isDefault);
    return member ? [member] : null;
  }

  // Variable declaration: export const foo = () => {}
  if (nodeType === 'VariableDeclaration') {
    const varDecl = node as unknown as VariableDeclaration;
    return extractVariableDeclarationMembers(varDecl, content, isDefault);
  }

  return null;
}

/**
 * Extract member from function declaration
 */
function extractFunctionMember(
  func: FunctionDeclaration,
  content: string,
  isDefault: boolean,
): ExportedMember | null {
  const name = func.identifier?.value ?? 'default';
  const params = extractParams(func.params ?? [], content);
  const returnType = extractReturnType(func.returnType, content);
  const isAsync = func.async ?? false;

  const result: ExportedMember = {
    name,
    kind: 'function',
    params,
    isAsync,
    isDefault,
  };

  if (returnType !== undefined) {
    result.returnType = returnType;
  }

  return result;
}

/**
 * Extract member from function expression (for default exports)
 */
function extractFunctionExpressionMember(
  func: FunctionExpression,
  content: string,
  isDefault: boolean,
): ExportedMember | null {
  const name = func.identifier?.value ?? 'default';
  const params = extractParams(func.params ?? [], content);
  const returnType = extractReturnType(func.returnType, content);
  const isAsync = func.async ?? false;

  const result: ExportedMember = {
    name,
    kind: 'function',
    params,
    isAsync,
    isDefault,
  };

  if (returnType !== undefined) {
    result.returnType = returnType;
  }

  return result;
}

/**
 * Extract member from class declaration
 */
function extractClassMember(
  cls: ClassDeclaration,
  content: string,
  isDefault: boolean,
): ExportedMember | null {
  const name = cls.identifier?.value ?? 'default';
  const methods = extractClassMethods(cls.body ?? [], content);

  return {
    name,
    kind: 'class',
    params: [], // Classes don't have top-level params
    isAsync: false,
    isDefault,
    methods,
  };
}

/**
 * Extract members from variable declaration (for arrow functions)
 */
function extractVariableDeclarationMembers(
  varDecl: VariableDeclaration,
  content: string,
  isDefault: boolean,
): ExportedMember[] {
  const members: ExportedMember[] = [];

  for (const declarator of varDecl.declarations) {
    const member = extractFromDeclarator(declarator, content, isDefault);
    if (member) {
      members.push(member);
    }
  }

  return members;
}

/**
 * Extract member from variable declarator
 */
function extractFromDeclarator(
  declarator: VariableDeclarator,
  content: string,
  isDefault: boolean,
): ExportedMember | null {
  const init = declarator.init;
  if (!init) return null;

  const initType = (init as { type?: string }).type;

  // Arrow function: export const foo = () => {}
  if (initType === 'ArrowFunctionExpression') {
    const arrow = init as unknown as ArrowFunctionExpression;
    const name = extractPatternName(declarator.id) ?? 'anonymous';
    const params = extractArrowParams(arrow.params ?? [], content);
    const returnType = extractReturnType(arrow.returnType, content);
    const isAsync = arrow.async ?? false;

    const result: ExportedMember = {
      name,
      kind: 'function',
      params,
      isAsync,
      isDefault,
    };

    if (returnType !== undefined) {
      result.returnType = returnType;
    }

    return result;
  }

  // Function expression: export const foo = function() {}
  if (initType === 'FunctionExpression') {
    const func = init as unknown as FunctionExpression;
    const name = extractPatternName(declarator.id) ?? func.identifier?.value ?? 'anonymous';
    const params = extractParams(func.params ?? [], content);
    const returnType = extractReturnType(func.returnType, content);
    const isAsync = func.async ?? false;

    const result: ExportedMember = {
      name,
      kind: 'function',
      params,
      isAsync,
      isDefault,
    };

    if (returnType !== undefined) {
      result.returnType = returnType;
    }

    return result;
  }

  return null;
}

/**
 * Extract parameter info from function params
 */
function extractParams(params: Param[], content: string): ParamInfo[] {
  return params.map((param) => extractParamInfo(param, content));
}

/**
 * Extract parameter info from arrow function params (Pattern[])
 */
function extractArrowParams(params: Pattern[], content: string): ParamInfo[] {
  return params.map((pat) => extractPatternParamInfo(pat, content));
}

/**
 * Extract info from a single parameter
 */
function extractParamInfo(param: Param, content: string): ParamInfo {
  const pat = param.pat as Pattern;
  return extractPatternParamInfo(pat, content);
}

/**
 * Extract param info from a pattern node
 */
function extractPatternParamInfo(pat: Pattern, content: string): ParamInfo {
  const patType = (pat as { type?: string }).type;

  // Simple identifier: (name: string)
  if (patType === 'Identifier') {
    const ident = pat as unknown as Identifier;
    const typeAnnotation = (ident as { typeAnnotation?: { typeAnnotation?: TsType } })
      .typeAnnotation;
    const typeStr = typeAnnotation?.typeAnnotation
      ? extractTypeString(typeAnnotation.typeAnnotation, content)
      : undefined;

    const result: ParamInfo = {
      name: ident.value,
      isOptional: ident.optional ?? false,
      hasDefault: false,
    };

    if (typeStr !== undefined) {
      result.type = typeStr;
    }

    return result;
  }

  // Assignment pattern: (name = 'default')
  if (patType === 'AssignmentPattern') {
    const assign = pat as unknown as { left: Pattern };
    const leftName = extractPatternName(assign.left);
    return {
      name: leftName ?? 'param',
      isOptional: true,
      hasDefault: true,
    };
  }

  // Rest parameter: (...args)
  if (patType === 'RestElement') {
    const rest = pat as unknown as { argument: Pattern };
    const argName = extractPatternName(rest.argument);
    return {
      name: argName ?? 'args',
      type: 'unknown[]',
      isOptional: true,
      hasDefault: false,
    };
  }

  // Object pattern: ({ a, b })
  if (patType === 'ObjectPattern') {
    return {
      name: 'options',
      type: 'object',
      isOptional: false,
      hasDefault: false,
    };
  }

  // Array pattern: ([a, b])
  if (patType === 'ArrayPattern') {
    return {
      name: 'items',
      type: 'unknown[]',
      isOptional: false,
      hasDefault: false,
    };
  }

  return {
    name: 'param',
    isOptional: false,
    hasDefault: false,
  };
}

/**
 * Extract name from a pattern node
 */
function extractPatternName(pat: Pattern): string | null {
  const patType = (pat as { type?: string }).type;

  if (patType === 'Identifier') {
    return (pat as unknown as Identifier).value;
  }

  return null;
}

/**
 * Extract return type as string
 */
function extractReturnType(
  returnType: { typeAnnotation?: TsType } | undefined,
  content: string,
): string | undefined {
  if (!returnType?.typeAnnotation) {
    return undefined;
  }

  return extractTypeString(returnType.typeAnnotation, content);
}

/**
 * Extract type as string from source content
 */
export function extractTypeString(typeNode: TsType, content: string): string {
  const span = (typeNode as { span?: { start: number; end: number } }).span;
  if (!span) {
    return 'unknown';
  }

  // SWC uses 1-based offsets
  const start = span.start - 1;
  const end = span.end - 1;

  let typeText = content.slice(start, end).trim();

  // Truncate long types
  if (typeText.length > 50) {
    typeText = `${typeText.slice(0, 47)}...`;
  }

  return typeText || 'unknown';
}

/**
 * Extract methods from class body
 */
function extractClassMethods(body: ClassMember[], content: string): MethodInfo[] {
  const methods: MethodInfo[] = [];

  for (const member of body) {
    const memberType = (member as { type?: string }).type;

    if (memberType === 'ClassMethod') {
      const method = member as unknown as ClassMethod;
      const methodInfo = extractMethodInfo(method, content);
      if (methodInfo) {
        methods.push(methodInfo);
      }
    }
  }

  return methods;
}

/**
 * Extract method info from class method
 */
function extractMethodInfo(method: ClassMethod, content: string): MethodInfo | null {
  const keyType = (method.key as { type?: string }).type;
  let name: string;

  if (keyType === 'Identifier') {
    name = (method.key as unknown as Identifier).value;
  } else {
    return null; // Skip computed property names
  }

  // Skip private methods (starting with #)
  if (name.startsWith('#')) {
    return null;
  }

  const params = extractParams(method.function?.params ?? [], content);
  const returnType = extractReturnType(method.function?.returnType, content);
  const isAsync = method.function?.async ?? false;
  const isStatic = method.isStatic ?? false;

  const result: MethodInfo = {
    name,
    params,
    isAsync,
    isStatic,
  };

  if (returnType !== undefined) {
    result.returnType = returnType;
  }

  return result;
}
