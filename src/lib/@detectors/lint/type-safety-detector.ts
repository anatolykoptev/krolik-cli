/**
 * @module lib/@detectors/lint/type-safety-detector
 * @description SWC AST detector for type-safety issues
 *
 * Detects:
 * - any type annotations
 * - as any type assertions
 * - as unknown as T double assertions
 * - non-null assertion operator (!)
 * - any in type parameters (Array<any>)
 * - any in function return types
 * - any in parameter types
 * - any[] array types
 */

import type { Node, Span } from '@swc/core';
import type { TypeSafetyDetection, TypeSafetyIssueType } from '../patterns/ast/types';

// ============================================================================
// TYPES
// ============================================================================

/** Node with type property */
interface TypedNode {
  type?: string;
  kind?: string;
  span?: Span;
  typeAnnotation?: Node;
  expression?: Node;
  typeParams?: { params?: Node[] };
  elemType?: Node;
}

/** Detection handler result */
type DetectionResult = TypeSafetyDetection | null;

/** Detection handler function */
type DetectionHandler = (node: TypedNode, span: Span) => DetectionResult;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if node is a `any` type keyword
 */
export function isAnyType(node: Node): boolean {
  const typedNode = node as TypedNode;
  return typedNode.type === 'TsKeywordType' && typedNode.kind === 'any';
}

/**
 * Check if node is an `unknown` type keyword
 */
export function isUnknownType(node: Node): boolean {
  const typedNode = node as TypedNode;
  return typedNode.type === 'TsKeywordType' && typedNode.kind === 'unknown';
}

/**
 * Create a detection result
 */
function createDetection(type: TypeSafetyIssueType, offset: number): TypeSafetyDetection {
  return { type, offset };
}

// ============================================================================
// INDIVIDUAL DETECTORS
// ============================================================================

/**
 * Detect `any` type in type annotations
 */
function detectTypeAnnotation(node: TypedNode, span: Span): DetectionResult {
  if (node.type !== 'TsTypeAnnotation') return null;

  const typeAnnotation = node.typeAnnotation;
  if (!typeAnnotation || !isAnyType(typeAnnotation)) return null;

  return createDetection('any-annotation', span.start);
}

/**
 * Detect `as any` type assertions
 */
function detectAsAnyAssertion(node: TypedNode, span: Span): DetectionResult {
  if (node.type !== 'TsAsExpression') return null;

  const typeAnnotation = node.typeAnnotation;
  if (!typeAnnotation || !isAnyType(typeAnnotation)) return null;

  return createDetection('any-assertion', span.start);
}

/**
 * Detect `as unknown as T` double assertions
 */
function detectDoubleAssertionPattern(node: TypedNode, span: Span): DetectionResult {
  if (node.type !== 'TsAsExpression') return null;

  const expression = node.expression as TypedNode | undefined;
  if (!expression || expression.type !== 'TsAsExpression') return null;

  const innerTypeAnnotation = expression.typeAnnotation as TypedNode | undefined;
  if (!innerTypeAnnotation) return null;

  const isUnknownAssertion =
    innerTypeAnnotation.type === 'TsKeywordType' && innerTypeAnnotation.kind === 'unknown';

  if (!isUnknownAssertion) return null;

  return createDetection('double-assertion', span.start);
}

/**
 * Detect non-null assertion operator (!)
 */
function detectNonNullAssertionHandler(node: TypedNode, span: Span): DetectionResult {
  if (node.type !== 'TsNonNullExpression') return null;

  return createDetection('non-null', span.start);
}

/**
 * Detect `any` in type parameters (e.g., Array<any>)
 */
function detectAnyInTypeParams(node: TypedNode, span: Span): DetectionResult {
  if (node.type !== 'TsTypeReference') return null;

  const params = node.typeParams?.params;
  if (!params) return null;

  for (const param of params) {
    if (isAnyType(param)) {
      return createDetection('any-annotation', span.start);
    }
  }

  return null;
}

/**
 * Detect `any` in function return types
 */
function detectAnyInReturnType(node: TypedNode, span: Span): DetectionResult {
  const functionTypes = ['TsFunctionType', 'TsConstructorType', 'TsMethodSignature'];
  if (!functionTypes.includes(node.type ?? '')) return null;

  const typeAnnotation = node.typeAnnotation as TypedNode | undefined;
  if (!typeAnnotation) return null;

  const returnType = typeAnnotation.typeAnnotation;
  if (!returnType || !isAnyType(returnType)) return null;

  return createDetection('any-annotation', span.start);
}

/**
 * Detect `any` in parameter types
 */
function detectAnyInParamType(node: TypedNode, span: Span): DetectionResult {
  if (node.type !== 'Parameter') return null;

  const typeAnnotation = node.typeAnnotation as TypedNode | undefined;
  if (!typeAnnotation) return null;

  const paramType = typeAnnotation.typeAnnotation;
  if (!paramType || !isAnyType(paramType)) return null;

  return createDetection('any-param', span.start);
}

/**
 * Detect `any` in array types (any[])
 */
function detectAnyInArrayType(node: TypedNode, span: Span): DetectionResult {
  if (node.type !== 'TsArrayType') return null;

  const elemType = node.elemType;
  if (!elemType || !isAnyType(elemType)) return null;

  return createDetection('any-array', span.start);
}

// ============================================================================
// DETECTION STRATEGIES
// ============================================================================

/**
 * Map of node types to their detection handlers.
 * Handlers are tried in order for matching node types.
 */
const detectionStrategies: Map<string, DetectionHandler[]> = new Map([
  ['TsTypeAnnotation', [detectTypeAnnotation]],
  ['TsAsExpression', [detectAsAnyAssertion, detectDoubleAssertionPattern]],
  ['TsNonNullExpression', [detectNonNullAssertionHandler]],
  ['TsTypeReference', [detectAnyInTypeParams]],
  ['TsFunctionType', [detectAnyInReturnType]],
  ['TsConstructorType', [detectAnyInReturnType]],
  ['TsMethodSignature', [detectAnyInReturnType]],
  ['Parameter', [detectAnyInParamType]],
  ['TsArrayType', [detectAnyInArrayType]],
]);

// ============================================================================
// MAIN DETECTOR
// ============================================================================

/**
 * Detect type-safety issue from AST node
 *
 * @param node - SWC AST node
 * @returns Detection result or null if no issue found
 */
export function detectTypeSafetyIssue(node: Node): TypeSafetyDetection | null {
  const typedNode = node as TypedNode;
  const { type: nodeType, span } = typedNode;

  if (!span || !nodeType) return null;

  const handlers = detectionStrategies.get(nodeType);
  if (!handlers) return null;

  for (const handler of handlers) {
    const result = handler(typedNode, span);
    if (result) return result;
  }

  return null;
}

// ============================================================================
// SPECIALIZED DETECTORS
// ============================================================================

/**
 * Detect any type annotation specifically
 */
export function detectAnyAnnotation(node: Node): TypeSafetyDetection | null {
  const result = detectTypeSafetyIssue(node);
  return result?.type === 'any-annotation' ? result : null;
}

/**
 * Detect as any assertion specifically
 */
export function detectAnyAssertion(node: Node): TypeSafetyDetection | null {
  const result = detectTypeSafetyIssue(node);
  return result?.type === 'any-assertion' ? result : null;
}

/**
 * Detect double assertion (as unknown as T) specifically
 */
export function detectDoubleAssertion(node: Node): TypeSafetyDetection | null {
  const result = detectTypeSafetyIssue(node);
  return result?.type === 'double-assertion' ? result : null;
}

/**
 * Detect non-null assertion (!) specifically
 */
export function detectNonNullAssertion(node: Node): TypeSafetyDetection | null {
  const result = detectTypeSafetyIssue(node);
  return result?.type === 'non-null' ? result : null;
}
