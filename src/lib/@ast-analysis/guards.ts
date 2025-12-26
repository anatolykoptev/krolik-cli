/**
 * @module lib/@ast-analysis/guards
 * @description Type guards for SWC AST node types
 *
 * SWC types are complex and often require type assertions.
 * These guards provide type-safe narrowing for common node types.
 */

import type {
  ArrowFunctionExpression,
  ClassDeclaration,
  ClassMethod,
  ExportDeclaration,
  ExportDefaultDeclaration,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  ModuleItem,
  Node,
  Pattern,
  TsInterfaceDeclaration,
  TsTypeAliasDeclaration,
  VariableDeclaration,
} from '@swc/core';

// ============================================================================
// BASE TYPE CHECK
// ============================================================================

type NodeWithType = { type?: string };

function hasType(node: unknown, type: string): boolean {
  return (node as NodeWithType).type === type;
}

// ============================================================================
// MODULE ITEM GUARDS
// ============================================================================

export function isExportDeclaration(item: ModuleItem): item is ExportDeclaration {
  return hasType(item, 'ExportDeclaration');
}

export function isExportDefaultDeclaration(item: ModuleItem): item is ExportDefaultDeclaration {
  return hasType(item, 'ExportDefaultDeclaration');
}

// ============================================================================
// DECLARATION GUARDS
// ============================================================================

export function isFunctionDeclaration(node: Node): node is FunctionDeclaration {
  return hasType(node, 'FunctionDeclaration');
}

export function isFunctionExpression(node: Node): node is FunctionExpression {
  return hasType(node, 'FunctionExpression');
}

export function isArrowFunction(node: Node): node is ArrowFunctionExpression {
  return hasType(node, 'ArrowFunctionExpression');
}

export function isClassDeclaration(node: Node): node is ClassDeclaration {
  return hasType(node, 'ClassDeclaration');
}

export function isVariableDeclaration(node: Node): node is VariableDeclaration {
  return hasType(node, 'VariableDeclaration');
}

export function isClassMethod(node: Node): node is ClassMethod {
  return hasType(node, 'ClassMethod');
}

// ============================================================================
// TYPE DECLARATION GUARDS
// ============================================================================

export function isTsTypeAlias(node: Node): node is TsTypeAliasDeclaration {
  return hasType(node, 'TsTypeAliasDeclaration');
}

export function isTsInterface(node: Node): node is TsInterfaceDeclaration {
  return hasType(node, 'TsInterfaceDeclaration');
}

export function isTsEnum(node: Node): boolean {
  return hasType(node, 'TsEnumDeclaration');
}

// ============================================================================
// PATTERN GUARDS
// ============================================================================

export function isIdentifier(node: Pattern | Node): node is Identifier {
  return hasType(node, 'Identifier');
}

export function isAssignmentPattern(node: Pattern): boolean {
  return hasType(node, 'AssignmentPattern');
}

export function isRestElement(node: Pattern): boolean {
  return hasType(node, 'RestElement');
}

export function isObjectPattern(node: Pattern): boolean {
  return hasType(node, 'ObjectPattern');
}

export function isArrayPattern(node: Pattern): boolean {
  return hasType(node, 'ArrayPattern');
}

// ============================================================================
// FUNCTION-LIKE TYPE
// ============================================================================

/**
 * Common interface for function-like nodes (FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)
 */
export interface FunctionLike {
  identifier?: Identifier;
  params?: unknown[];
  returnType?: { typeAnnotation?: unknown };
  async?: boolean;
}

export function isFunctionLike(
  node: Node,
): node is FunctionDeclaration | FunctionExpression | ArrowFunctionExpression {
  return isFunctionDeclaration(node) || isFunctionExpression(node) || isArrowFunction(node);
}
