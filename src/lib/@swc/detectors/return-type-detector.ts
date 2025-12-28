/**
 * @module lib/@swc/detectors/return-type-detector
 * @description Detector for missing return types on exported functions
 *
 * Detects missing return type annotations on:
 * - export function foo() { }
 * - export async function bar() { }
 * - export const fn = () => { }
 * - export const fn2 = function() { }
 * - export default function() { }
 *
 * Only checks exported functions, skips internal/private functions.
 */

import type { Node, Span } from '@swc/core';
import type { ReturnTypeDetection } from './types';

/**
 * Check if function has return type annotation
 */
function hasReturnType(node: Node): boolean {
  const returnType = (node as { returnType?: Node }).returnType;
  return !!returnType;
}

/**
 * Check if node is an async function
 */
function isAsyncFunction(node: Node): boolean {
  const async = (node as { async?: boolean }).async;
  return !!async;
}

/**
 * Extract function name from FunctionDeclaration
 */
function getFunctionName(node: Node): string {
  const identifier = (node as { identifier?: { value?: string } }).identifier;
  return identifier?.value ?? 'anonymous';
}

/**
 * Detect missing return type on ExportDeclaration with FunctionDeclaration
 */
export function detectExportedFunctionReturnType(node: Node): ReturnTypeDetection | null {
  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (nodeType !== 'ExportDeclaration' || !span) {
    return null;
  }

  const declaration = (node as { declaration?: Node }).declaration;
  if (!declaration) {
    return null;
  }

  const declarationType = (declaration as { type?: string }).type;

  // export function foo() { }
  if (declarationType === 'FunctionDeclaration') {
    if (!hasReturnType(declaration)) {
      return {
        type: 'missing-return-type-function',
        offset: span.start,
        functionName: getFunctionName(declaration),
        isAsync: isAsyncFunction(declaration),
      };
    }
  }

  // export const fn = () => { } or export const fn = function() { }
  if (declarationType === 'VariableDeclaration') {
    const declarations = (declaration as { declarations?: Node[] }).declarations;
    if (!declarations) {
      return null;
    }

    for (const declarator of declarations) {
      const declaratorType = (declarator as { type?: string }).type;
      if (declaratorType !== 'VariableDeclarator') continue;

      const id = (declarator as { id?: Node }).id;
      const init = (declarator as { init?: Node }).init;

      if (!id || !init) continue;

      // Get variable name
      const idType = (id as { type?: string }).type;
      let varName = 'anonymous';
      if (idType === 'Identifier') {
        varName = (id as { value?: string }).value ?? 'anonymous';
      }

      const initType = (init as { type?: string }).type;

      // Check arrow function: const fn = () => { }
      if (initType === 'ArrowFunctionExpression') {
        if (!hasReturnType(init)) {
          return {
            type: 'missing-return-type-arrow',
            offset: span.start,
            functionName: varName,
            isAsync: isAsyncFunction(init),
          };
        }
      }

      // Check function expression: const fn = function() { }
      if (initType === 'FunctionExpression') {
        if (!hasReturnType(init)) {
          return {
            type: 'missing-return-type-expression',
            offset: span.start,
            functionName: varName,
            isAsync: isAsyncFunction(init),
          };
        }
      }
    }
  }

  return null;
}

/**
 * Detect missing return type on ExportDefaultDeclaration with function
 */
export function detectDefaultExportReturnType(node: Node): ReturnTypeDetection | null {
  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (nodeType !== 'ExportDefaultDeclaration' || !span) {
    return null;
  }

  const declaration = (node as { decl?: Node }).decl;
  if (!declaration) {
    return null;
  }

  const declarationType = (declaration as { type?: string }).type;

  // export default function() { }
  if (declarationType === 'FunctionExpression') {
    if (!hasReturnType(declaration)) {
      const identifier = (declaration as { identifier?: { value?: string } }).identifier;
      return {
        type: 'missing-return-type-default',
        offset: span.start,
        functionName: identifier?.value ?? 'anonymous',
        isAsync: isAsyncFunction(declaration),
      };
    }
  }

  // export default () => { }
  if (declarationType === 'ArrowFunctionExpression') {
    if (!hasReturnType(declaration)) {
      return {
        type: 'missing-return-type-default',
        offset: span.start,
        functionName: 'anonymous',
        isAsync: isAsyncFunction(declaration),
      };
    }
  }

  return null;
}

/**
 * Detect missing return type on any exported function
 *
 * This is the main entry point that combines all return type detectors.
 */
export function detectReturnTypeIssue(node: Node): ReturnTypeDetection | null {
  // Check ExportDeclaration (named exports)
  const exportedIssue = detectExportedFunctionReturnType(node);
  if (exportedIssue) {
    return exportedIssue;
  }

  // Check ExportDefaultDeclaration (default exports)
  const defaultIssue = detectDefaultExportReturnType(node);
  if (defaultIssue) {
    return defaultIssue;
  }

  return null;
}
