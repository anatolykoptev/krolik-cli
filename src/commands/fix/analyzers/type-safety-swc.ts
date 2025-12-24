/**
 * @module commands/fix/analyzers/type-safety-swc
 * @description SWC AST-based type-safety analyzer
 *
 * Replaces regex-based type-safety.ts using AST visitor pattern for accurate detection.
 * Detects: any type, as any, @ts-ignore, @ts-nocheck, non-null assertion (!)
 */

import type { Node, Span } from '@swc/core';
import { parseSync } from '@swc/core';
import { shouldSkipForAnalysis } from '../../../lib/@patterns';
import type { QualityIssue } from '../types';

/**
 * Calculate line offsets for position mapping
 */
function calculateLineOffsets(content: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Convert byte offset to line number
 */
function offsetToLine(offset: number, lineOffsets: number[]): number {
  let line = 0;
  for (let i = 0; i < lineOffsets.length; i++) {
    if ((lineOffsets[i] ?? 0) > offset) {
      break;
    }
    line = i;
  }
  return line + 1;
}

/**
 * Extract snippet from content at given offset
 */
function getSnippet(content: string, offset: number, lineOffsets: number[]): string {
  const lineNum = offsetToLine(offset, lineOffsets) - 1;
  const lines = content.split('\n');
  const line = lines[lineNum] ?? '';
  return line.trim().slice(0, 80);
}

/**
 * Check for @ts-ignore and @ts-nocheck in comments
 */
function checkTsDirectives(content: string, filepath: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Check for @ts-ignore
    if (/@ts-ignore/.test(trimmed)) {
      // Skip if it's inside a string literal
      const firstQuote = trimmed.indexOf("'");
      const firstDoubleQuote = trimmed.indexOf('"');
      const firstBacktick = trimmed.indexOf('`');
      const commentPos = trimmed.indexOf('@ts-ignore');

      const inString =
        (firstQuote !== -1 && firstQuote < commentPos) ||
        (firstDoubleQuote !== -1 && firstDoubleQuote < commentPos) ||
        (firstBacktick !== -1 && firstBacktick < commentPos);

      if (!inString) {
        issues.push({
          file: filepath,
          line: i + 1,
          severity: 'error',
          category: 'type-safety',
          message: '@ts-ignore suppresses TypeScript errors',
          suggestion: 'Fix the type error instead of ignoring it',
          snippet: trimmed.slice(0, 80),
          fixerId: 'no-ts-ignore',
        });
      }
    }

    // Check for @ts-nocheck (typically at top of file)
    if (/@ts-nocheck/.test(trimmed)) {
      issues.push({
        file: filepath,
        line: i + 1,
        severity: 'error',
        category: 'type-safety',
        message: '@ts-nocheck disables TypeScript checking for entire file',
        suggestion: 'Remove @ts-nocheck and fix type errors',
        snippet: trimmed.slice(0, 80),
        fixerId: 'no-ts-ignore',
      });
    }

    // Check for @ts-expect-error without explanation
    if (/@ts-expect-error(?!\s+—)/.test(trimmed)) {
      issues.push({
        file: filepath,
        line: i + 1,
        severity: 'info',
        category: 'type-safety',
        message: '@ts-expect-error without explanation',
        suggestion: 'Add a comment explaining why this is expected',
        snippet: trimmed.slice(0, 80),
        fixerId: 'no-ts-ignore',
      });
    }
  }

  return issues;
}

/**
 * Visit all nodes in the AST
 */
function visitNode(
  node: Node,
  callback: (node: Node) => void,
  visited = new WeakSet<object>(),
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  // Prevent infinite loops from circular references
  if (visited.has(node)) {
    return;
  }
  visited.add(node);

  callback(node);

  // Visit children
  for (const key of Object.keys(node)) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          visitNode(item as Node, callback, visited);
        }
      }
    } else if (value && typeof value === 'object' && key !== 'span') {
      visitNode(value as Node, callback, visited);
    }
  }
}

/**
 * Check if node is a `any` type annotation
 */
function isAnyType(node: Node): boolean {
  const nodeType = (node as { type?: string }).type;

  // TsKeywordType with kind 'any'
  if (nodeType === 'TsKeywordType') {
    const kind = (node as { kind?: string }).kind;
    return kind === 'any';
  }

  return false;
}

/**
 * Check for type safety issues using SWC AST
 */
export function checkTypeSafetySwc(content: string, filepath: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Skip .d.ts files and test files
  if (filepath.endsWith('.d.ts') || filepath.includes('.test.') || filepath.includes('.spec.')) {
    return issues;
  }

  // Skip infrastructure files (pattern definitions, constants, etc.)
  if (shouldSkipForAnalysis(filepath)) {
    return issues;
  }

  // Check for @ts-ignore and @ts-nocheck in comments
  issues.push(...checkTsDirectives(content, filepath));

  // Parse with SWC
  let ast: Node;
  try {
    ast = parseSync(content, {
      syntax: 'typescript',
      tsx: filepath.endsWith('.tsx'),
      comments: true, // Enable comment parsing
    });
  } catch {
    // Parse error - skip AST analysis but keep comment-based checks
    return issues;
  }

  const lineOffsets = calculateLineOffsets(content);

  // Visit all nodes and detect type safety issues
  visitNode(ast, (node) => {
    const nodeType = (node as { type?: string }).type;
    const span = (node as { span?: Span }).span;

    if (!span) return;

    const line = offsetToLine(span.start, lineOffsets);
    const snippet = getSnippet(content, span.start, lineOffsets);

    // 1. Detect `any` type in type annotations
    if (nodeType === 'TsTypeAnnotation') {
      const typeAnnotation = (node as { typeAnnotation?: Node }).typeAnnotation;
      if (typeAnnotation && isAnyType(typeAnnotation)) {
        issues.push({
          file: filepath,
          line,
          severity: 'warning',
          category: 'type-safety',
          message: 'Using `any` type',
          suggestion: 'Use proper TypeScript types, `unknown`, or generics',
          snippet,
          fixerId: 'no-any',
        });
      }
    }

    // 2. Detect `as any` type assertions
    if (nodeType === 'TsAsExpression') {
      const typeAnnotation = (node as { typeAnnotation?: Node }).typeAnnotation;
      if (typeAnnotation && isAnyType(typeAnnotation)) {
        issues.push({
          file: filepath,
          line,
          severity: 'warning',
          category: 'type-safety',
          message: 'Type assertion to `any`',
          suggestion: 'Use proper type assertion or fix the underlying type issue',
          snippet,
          fixerId: 'no-any',
        });
      }
    }

    // 3. Detect non-null assertion operator (!)
    if (nodeType === 'TsNonNullExpression') {
      issues.push({
        file: filepath,
        line,
        severity: 'info',
        category: 'type-safety',
        message: 'Non-null assertion operator (!)',
        suggestion: 'Use optional chaining (?.) or proper null checks',
        snippet,
        fixerId: 'no-non-null-assertion',
      });
    }

    // 4. Detect `any` in type parameters (e.g., Array<any>)
    if (nodeType === 'TsTypeReference') {
      const typeParams = (node as { typeParams?: { params?: Node[] } }).typeParams;
      if (typeParams?.params) {
        for (const param of typeParams.params) {
          if (isAnyType(param)) {
            issues.push({
              file: filepath,
              line,
              severity: 'warning',
              category: 'type-safety',
              message: 'Using `any` in type parameter',
              suggestion: 'Use proper TypeScript types or generics',
              snippet,
              fixerId: 'no-any',
            });
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
          issues.push({
            file: filepath,
            line,
            severity: 'warning',
            category: 'type-safety',
            message: 'Using `any` as return type',
            suggestion: 'Use proper TypeScript return type',
            snippet,
            fixerId: 'no-any',
          });
        }
      }
    }

    // 6. Detect `any` in parameter types
    if (nodeType === 'Parameter') {
      const typeAnnotation = (node as { typeAnnotation?: Node }).typeAnnotation;
      if (typeAnnotation) {
        const paramType = (typeAnnotation as { typeAnnotation?: Node }).typeAnnotation;
        if (paramType && isAnyType(paramType)) {
          issues.push({
            file: filepath,
            line,
            severity: 'warning',
            category: 'type-safety',
            message: 'Using `any` in parameter type',
            suggestion: 'Use proper TypeScript parameter type or `unknown`',
            snippet,
            fixerId: 'no-any',
          });
        }
      }
    }

    // 7. Detect `any` in array types (any[])
    if (nodeType === 'TsArrayType') {
      const elemType = (node as { elemType?: Node }).elemType;
      if (elemType && isAnyType(elemType)) {
        issues.push({
          file: filepath,
          line,
          severity: 'warning',
          category: 'type-safety',
          message: 'Using `any[]` array type',
          suggestion: 'Use proper array element type',
          snippet,
          fixerId: 'no-any',
        });
      }
    }
  });

  return issues;
}
