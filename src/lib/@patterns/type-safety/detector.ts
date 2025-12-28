/**
 * @module lib/@patterns/type-safety/detector
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
import type { TypeSafetyDetection } from '@/lib/@swc/detectors/types';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if node is a `any` type keyword
 */
export function isAnyType(node: Node): boolean {
  const nodeType = (node as { type?: string }).type;

  // TsKeywordType with kind 'any'
  if (nodeType === 'TsKeywordType') {
    const kind = (node as { kind?: string }).kind;
    return kind === 'any';
  }

  return false;
}

/**
 * Check if node is an `unknown` type keyword
 */
export function isUnknownType(node: Node): boolean {
  const nodeType = (node as { type?: string }).type;

  if (nodeType === 'TsKeywordType') {
    const kind = (node as { kind?: string }).kind;
    return kind === 'unknown';
  }

  return false;
}

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
  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (!span) return null;

  // 1. Detect `any` type in type annotations
  if (nodeType === 'TsTypeAnnotation') {
    const typeAnnotation = (node as { typeAnnotation?: Node }).typeAnnotation;
    if (typeAnnotation && isAnyType(typeAnnotation)) {
      return {
        type: 'any-annotation',
        offset: span.start,
      };
    }
  }

  // 2. Detect `as any` type assertions and `as unknown as T` double assertions
  if (nodeType === 'TsAsExpression') {
    const typeAnnotation = (node as { typeAnnotation?: Node }).typeAnnotation;
    const expression = (node as { expression?: Node }).expression;

    // Check for `as any`
    if (typeAnnotation && isAnyType(typeAnnotation)) {
      return {
        type: 'any-assertion',
        offset: span.start,
      };
    }

    // Check for `as unknown as T` (double assertion pattern)
    if (expression && (expression as { type?: string }).type === 'TsAsExpression') {
      const innerTypeAnnotation = (expression as { typeAnnotation?: Node }).typeAnnotation;
      if (innerTypeAnnotation) {
        const innerType = (innerTypeAnnotation as { type?: string }).type;
        const innerKind = (innerTypeAnnotation as { kind?: string }).kind;
        // Check if inner assertion is `as unknown`
        if (innerType === 'TsKeywordType' && innerKind === 'unknown') {
          return {
            type: 'double-assertion',
            offset: span.start,
          };
        }
      }
    }
  }

  // 3. Detect non-null assertion operator (!)
  if (nodeType === 'TsNonNullExpression') {
    return {
      type: 'non-null',
      offset: span.start,
    };
  }

  // 4. Detect `any` in type parameters (e.g., Array<any>)
  if (nodeType === 'TsTypeReference') {
    const typeParams = (node as { typeParams?: { params?: Node[] } }).typeParams;
    if (typeParams?.params) {
      for (const param of typeParams.params) {
        if (isAnyType(param)) {
          return {
            type: 'any-annotation',
            offset: span.start,
          };
        }
      }
    }
  }

  // 5. Detect `any` in function return types
  if (
    nodeType === 'TsFunctionType' ||
    nodeType === 'TsConstructorType' ||
    nodeType === 'TsMethodSignature'
  ) {
    const typeAnnotation = (node as { typeAnnotation?: Node }).typeAnnotation;
    if (typeAnnotation) {
      const returnType = (typeAnnotation as { typeAnnotation?: Node }).typeAnnotation;
      if (returnType && isAnyType(returnType)) {
        return {
          type: 'any-annotation',
          offset: span.start,
        };
      }
    }
  }

  // 6. Detect `any` in parameter types
  if (nodeType === 'Parameter') {
    const typeAnnotation = (node as { typeAnnotation?: Node }).typeAnnotation;
    if (typeAnnotation) {
      const paramType = (typeAnnotation as { typeAnnotation?: Node }).typeAnnotation;
      if (paramType && isAnyType(paramType)) {
        return {
          type: 'any-param',
          offset: span.start,
        };
      }
    }
  }

  // 7. Detect `any` in array types (any[])
  if (nodeType === 'TsArrayType') {
    const elemType = (node as { elemType?: Node }).elemType;
    if (elemType && isAnyType(elemType)) {
      return {
        type: 'any-array',
        offset: span.start,
      };
    }
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
