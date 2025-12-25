/**
 * @module commands/fix/analyzers/return-types-swc
 * @description SWC AST-based analyzer for missing return types on exported functions
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
import { parseSync } from '@swc/core';
import { shouldSkipForAnalysis } from '../../../lib/@patterns';
import { calculateLineOffsets, getSnippet, offsetToLine, visitNode } from '../../../lib/@swc';
import type { QualityIssue } from '../types';

/**
 * Extract function name from various node types
 */
function getFunctionName(node: Node): string {
  const nodeType = (node as { type?: string }).type;

  // FunctionDeclaration
  if (nodeType === 'FunctionDeclaration') {
    const identifier = (node as { identifier?: { value?: string } }).identifier;
    return identifier?.value ?? 'anonymous';
  }

  // ArrowFunctionExpression or FunctionExpression
  // (name comes from parent VariableDeclarator)
  return 'anonymous';
}

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
 * Check for missing return types on exported functions
 */
export function checkReturnTypesSwc(content: string, filepath: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Skip .d.ts files and test files
  if (filepath.endsWith('.d.ts') || filepath.includes('.test.') || filepath.includes('.spec.')) {
    return issues;
  }

  // Skip infrastructure files (pattern definitions, constants, etc.)
  if (shouldSkipForAnalysis(filepath)) {
    return issues;
  }

  // Parse with SWC
  let ast: Node;
  try {
    ast = parseSync(content, {
      syntax: 'typescript',
      tsx: filepath.endsWith('.tsx'),
      comments: false,
    });
  } catch {
    // Parse error - skip AST analysis
    return issues;
  }

  const lineOffsets = calculateLineOffsets(content);

  // Visit all nodes and detect missing return types on exports
  visitNode(ast, (node, _context) => {
    const nodeType = (node as { type?: string }).type;
    const span = (node as { span?: Span }).span;

    if (!span) return;

    // 1. ExportDeclaration with FunctionDeclaration
    if (nodeType === 'ExportDeclaration') {
      const declaration = (node as { declaration?: Node }).declaration;
      if (!declaration) return;

      const declarationType = (declaration as { type?: string }).type;

      // export function foo() { }
      if (declarationType === 'FunctionDeclaration') {
        if (!hasReturnType(declaration)) {
          const functionName = getFunctionName(declaration);
          const line = offsetToLine(span.start, lineOffsets);
          const snippet = getSnippet(content, span.start, lineOffsets);
          const isAsync = isAsyncFunction(declaration);

          issues.push({
            file: filepath,
            line,
            severity: 'info',
            category: 'type-safety',
            message: `Exported function "${functionName}" is missing explicit return type${isAsync ? ' (should be Promise<T>)' : ''}`,
            suggestion: 'Add explicit return type for better type safety',
            snippet,
            fixerId: 'explicit-return-types',
          });
        }
      }

      // export const fn = () => { } or export const fn = function() { }
      if (declarationType === 'VariableDeclaration') {
        const declarations = (declaration as { declarations?: Node[] }).declarations;
        if (!declarations) return;

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
              const line = offsetToLine(span.start, lineOffsets);
              const snippet = getSnippet(content, span.start, lineOffsets);
              const isAsync = isAsyncFunction(init);

              issues.push({
                file: filepath,
                line,
                severity: 'info',
                category: 'type-safety',
                message: `Exported arrow function "${varName}" is missing explicit return type${isAsync ? ' (should be Promise<T>)' : ''}`,
                suggestion: 'Add explicit return type for better type safety',
                snippet,
                fixerId: 'explicit-return-types',
              });
            }
          }

          // Check function expression: const fn = function() { }
          if (initType === 'FunctionExpression') {
            if (!hasReturnType(init)) {
              const line = offsetToLine(span.start, lineOffsets);
              const snippet = getSnippet(content, span.start, lineOffsets);
              const isAsync = isAsyncFunction(init);

              issues.push({
                file: filepath,
                line,
                severity: 'info',
                category: 'type-safety',
                message: `Exported function expression "${varName}" is missing explicit return type${isAsync ? ' (should be Promise<T>)' : ''}`,
                suggestion: 'Add explicit return type for better type safety',
                snippet,
                fixerId: 'explicit-return-types',
              });
            }
          }
        }
      }
    }

    // 2. ExportDefaultDeclaration with function
    if (nodeType === 'ExportDefaultDeclaration') {
      const declaration = (node as { decl?: Node }).decl;
      if (!declaration) return;

      const declarationType = (declaration as { type?: string }).type;

      // export default function() { }
      if (declarationType === 'FunctionExpression') {
        if (!hasReturnType(declaration)) {
          const functionName = getFunctionName(declaration);
          const line = offsetToLine(span.start, lineOffsets);
          const snippet = getSnippet(content, span.start, lineOffsets);
          const isAsync = isAsyncFunction(declaration);

          issues.push({
            file: filepath,
            line,
            severity: 'info',
            category: 'type-safety',
            message: `Exported default function "${functionName}" is missing explicit return type${isAsync ? ' (should be Promise<T>)' : ''}`,
            suggestion: 'Add explicit return type for better type safety',
            snippet,
            fixerId: 'explicit-return-types',
          });
        }
      }

      // export default () => { }
      if (declarationType === 'ArrowFunctionExpression') {
        if (!hasReturnType(declaration)) {
          const line = offsetToLine(span.start, lineOffsets);
          const snippet = getSnippet(content, span.start, lineOffsets);
          const isAsync = isAsyncFunction(declaration);

          issues.push({
            file: filepath,
            line,
            severity: 'info',
            category: 'type-safety',
            message: `Exported default arrow function is missing explicit return type${isAsync ? ' (should be Promise<T>)' : ''}`,
            suggestion: 'Add explicit return type for better type safety',
            snippet,
            fixerId: 'explicit-return-types',
          });
        }
      }
    }
  });

  return issues;
}
