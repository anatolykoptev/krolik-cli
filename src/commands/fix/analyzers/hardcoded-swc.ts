/**
 * @module commands/fix/analyzers/hardcoded-swc
 * @description SWC AST-based hardcoded value detection
 *
 * Replaces regex-based hardcoded.ts using AST visitor pattern for accurate detection.
 * Uses @swc/core for 10-20x faster parsing compared to ts-morph.
 */

import type { Node, Span } from '@swc/core';
import { parseSync } from '@swc/core';
import {
  ACCEPTABLE_NUMBERS,
  shouldSkipFile,
  shouldSkipUrl,
} from '../../../lib/@patterns/hardcoded/index';
import type { HardcodedValue } from '../types';

/**
 * Detect hardcoded values using SWC AST
 */
export function detectHardcodedSwc(content: string, filepath: string): HardcodedValue[] {
  if (shouldSkipFile(filepath)) {
    return [];
  }

  const values: HardcodedValue[] = [];

  try {
    const ast = parseSync(content, {
      syntax: 'typescript',
      tsx: filepath.endsWith('.tsx'),
    });

    // Calculate line offsets for position mapping
    const lineOffsets = calculateLineOffsets(content);

    // Visit all nodes with context
    visitNode(ast, content, lineOffsets, values, filepath, { isTopLevel: true });
  } catch {
    // Parse error - gracefully return empty results
  }

  return values;
}

/**
 * Context for tracking parent nodes
 */
interface VisitorContext {
  isTopLevel: boolean;
  inConstDeclaration?: boolean;
  inMemberExpression?: boolean;
  parentType?: string;
}

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
 * Extract context string from content at position
 */
function getContext(content: string, span: Span | undefined, lineOffsets: number[]): string {
  if (!span) return '';

  const line = offsetToLine(span.start, lineOffsets);
  const lineStart = lineOffsets[line - 1] ?? 0;

  // Find the actual line end (next newline or EOF)
  let lineEnd = content.indexOf('\n', lineStart);
  if (lineEnd === -1) {
    lineEnd = content.length;
  }
  const lineContent = content.slice(lineStart, lineEnd).trim();

  const MAX_CONTEXT_LENGTH = 80;
  return lineContent.slice(0, MAX_CONTEXT_LENGTH);
}

/**
 * Check if node is inside a const declaration at top level
 */
function isInConstDeclaration(node: Node, context: VisitorContext): boolean {
  const nodeType = (node as { type?: string }).type;

  // Check if we're in a top-level const declaration with SCREAMING_SNAKE_CASE
  if (
    nodeType === 'VariableDeclaration' &&
    context.isTopLevel &&
    (node as { kind?: string }).kind === 'const'
  ) {
    const declarations = (node as { declarations?: Array<{ id?: { value?: string } }> })
      .declarations;
    if (declarations && declarations.length > 0) {
      const id = declarations[0]?.id;
      const name = (id as { value?: string })?.value ?? '';
      // SCREAMING_SNAKE_CASE indicates intentional constant
      return /^[A-Z][A-Z0-9_]*$/.test(name);
    }
  }

  return context.inConstDeclaration ?? false;
}

/**
 * Check if numeric literal is in a computed member expression (array index)
 */
function isArrayIndex(context: VisitorContext): boolean {
  return context.parentType === 'MemberExpression' && context.inMemberExpression === true;
}

/**
 * Visit children nodes
 */
function visitChildren(
  node: Node,
  content: string,
  lineOffsets: number[],
  values: HardcodedValue[],
  filepath: string,
  context: VisitorContext,
): void {
  for (const key of Object.keys(node)) {
    const value = (node as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          visitNode(item as Node, content, lineOffsets, values, filepath, context);
        }
      }
    } else if (value && typeof value === 'object') {
      visitNode(value as Node, content, lineOffsets, values, filepath, context);
    }
  }
}

/**
 * Visit AST node and detect hardcoded values
 */
function visitNode(
  node: Node,
  content: string,
  lineOffsets: number[],
  values: HardcodedValue[],
  filepath: string,
  context: VisitorContext,
): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  // Update context for MemberExpression with computed property FIRST
  // This needs to be set before checking NumericLiterals
  let inMemberExpression = context.inMemberExpression;
  if (nodeType === 'MemberExpression') {
    const property = (node as { property?: { type?: string } }).property;
    inMemberExpression = property?.type === 'Computed';
  }

  // Update context based on current node
  const newContext: VisitorContext = {
    ...context,
    isTopLevel: context.isTopLevel && nodeType !== 'FunctionDeclaration',
    inConstDeclaration: isInConstDeclaration(node, context),
    inMemberExpression,
    parentType: nodeType,
  };

  // 1. MAGIC NUMBERS - NumericLiteral nodes
  if (nodeType === 'NumericLiteral') {
    const value = (node as { value?: number }).value;

    if (value !== undefined && !ACCEPTABLE_NUMBERS.has(value)) {
      // Skip if in const declaration at top-level (intentional constants)
      if (newContext.inConstDeclaration) {
        // NumericLiterals are leaf nodes, no children to visit
        return;
      }

      // Skip array indices (check incoming context from parent)
      if (isArrayIndex(context)) {
        // NumericLiterals are leaf nodes, no children to visit
        return;
      }

      const line = span ? offsetToLine(span.start, lineOffsets) : 0;
      const ctx = getContext(content, span, lineOffsets);

      // Skip timeout/delay contexts (these are typically configuration)
      if (ctx.toLowerCase().includes('timeout') || ctx.toLowerCase().includes('delay')) {
        // NumericLiterals are leaf nodes, no children to visit
        return;
      }

      values.push({
        value,
        type: 'number',
        line,
        context: ctx,
      });
    }
  }

  // 2. HARDCODED URLS - StringLiteral nodes containing http:// or https://
  if (nodeType === 'StringLiteral') {
    const value = (node as { value?: string }).value ?? '';

    if (value.startsWith('http://') || value.startsWith('https://')) {
      // Skip localhost and example URLs
      const isSkipped =
        value.includes('localhost') ||
        value.includes('example.com') ||
        value.includes('example.org') ||
        value.includes('w3.org') ||
        shouldSkipUrl(value);

      if (!isSkipped) {
        const line = span ? offsetToLine(span.start, lineOffsets) : 0;
        const ctx = getContext(content, span, lineOffsets);

        values.push({
          value,
          type: 'url',
          line,
          context: ctx,
        });
      }
    }

    // 3. HEX COLORS - StringLiteral matching #[0-9A-Fa-f]{3,6}
    const hexColorPattern = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
    if (hexColorPattern.test(value)) {
      // Skip tailwind.config files
      if (filepath.includes('tailwind')) {
        return;
      }

      // Skip CSS files
      if (filepath.endsWith('.css') || filepath.endsWith('.scss')) {
        return;
      }

      const line = span ? offsetToLine(span.start, lineOffsets) : 0;
      const ctx = getContext(content, span, lineOffsets);

      values.push({
        value,
        type: 'color',
        line,
        context: ctx,
      });
    }
  }

  // Visit children
  visitChildren(node, content, lineOffsets, values, filepath, newContext);
}
