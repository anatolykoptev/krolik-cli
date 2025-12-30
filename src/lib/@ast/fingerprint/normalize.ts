/**
 * @module lib/@ast/fingerprint/normalize
 * @description AST normalization for structural comparison
 *
 * Normalizes AST nodes by replacing variable parts with placeholders,
 * allowing structural comparison regardless of naming.
 */

import type { Node } from '@swc/core';

/**
 * Options for AST normalization
 */
export interface NormalizeOptions {
  /** Replace identifier names with placeholders (default: true) */
  normalizeIdentifiers?: boolean;
  /** Replace string literals with placeholder (default: true) */
  normalizeStrings?: boolean;
  /** Replace number literals with placeholder (default: true) */
  normalizeNumbers?: boolean;
  /** Include node types in output (default: true) */
  includeTypes?: boolean;
  /** Maximum depth to traverse (default: 50) */
  maxDepth?: number;
}

const DEFAULT_OPTIONS: Required<NormalizeOptions> = {
  normalizeIdentifiers: true,
  normalizeStrings: true,
  normalizeNumbers: true,
  includeTypes: true,
  maxDepth: 50,
};

/**
 * Placeholder tokens for normalized values
 */
const PLACEHOLDERS = {
  IDENTIFIER: '$ID',
  STRING: '$STR',
  NUMBER: '$NUM',
  REGEX: '$RGX',
  TEMPLATE: '$TPL',
} as const;

/**
 * Node types to skip during normalization (not structurally significant)
 */
const SKIP_KEYS = new Set([
  'span',
  'start',
  'end',
  'loc',
  'range',
  'comments',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'extra',
  'raw',
  'rawValue',
]);

/**
 * Normalize an AST node for structural comparison
 *
 * Replaces identifiers, literals, and other variable parts
 * with placeholders to enable structural comparison.
 *
 * @example
 * ```typescript
 * const ast = parseSync('function foo(x) { return x + 1; }');
 * const normalized = normalizeAst(ast);
 * // Result ignores 'foo', 'x', and '1' - only structure matters
 * ```
 */
export function normalizeAst(
  node: Node | unknown,
  options: NormalizeOptions = {},
  depth = 0,
): unknown {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Depth limit protection
  if (depth > opts.maxDepth) {
    return { type: '$MAX_DEPTH' };
  }

  // Handle null/undefined
  if (node === null || node === undefined) {
    return null;
  }

  // Handle primitives
  if (typeof node !== 'object') {
    return node;
  }

  // Handle arrays
  if (Array.isArray(node)) {
    return node.map((item) => normalizeAst(item, opts, depth + 1));
  }

  // Handle objects (AST nodes)
  const obj = node as Record<string, unknown>;
  const nodeType = obj.type as string | undefined;

  // Normalize based on node type
  if (nodeType) {
    return normalizeNodeByType(obj, nodeType, opts, depth);
  }

  // Generic object normalization
  return normalizeGenericObject(obj, opts, depth);
}

/**
 * Normalize a node based on its type
 */
function normalizeNodeByType(
  node: Record<string, unknown>,
  nodeType: string,
  opts: Required<NormalizeOptions>,
  depth: number,
): unknown {
  // Identifiers → placeholder
  if (nodeType === 'Identifier' && opts.normalizeIdentifiers) {
    return { type: 'Identifier', name: PLACEHOLDERS.IDENTIFIER };
  }

  // String literals → placeholder
  if (nodeType === 'StringLiteral' && opts.normalizeStrings) {
    return { type: 'StringLiteral', value: PLACEHOLDERS.STRING };
  }

  // Number literals → placeholder
  if ((nodeType === 'NumericLiteral' || nodeType === 'NumberLiteral') && opts.normalizeNumbers) {
    return { type: 'NumericLiteral', value: PLACEHOLDERS.NUMBER };
  }

  // BigInt literals → placeholder
  if (nodeType === 'BigIntLiteral' && opts.normalizeNumbers) {
    return { type: 'BigIntLiteral', value: PLACEHOLDERS.NUMBER };
  }

  // Regex literals → placeholder (keep flags for structure)
  if (nodeType === 'RegExpLiteral') {
    const flags = node.flags as string | undefined;
    return { type: 'RegExpLiteral', pattern: PLACEHOLDERS.REGEX, flags };
  }

  // Template literals → normalize quasi values
  if (nodeType === 'TemplateLiteral' && opts.normalizeStrings) {
    const quasis = node.quasis as unknown[] | undefined;
    const expressions = node.expressions as unknown[] | undefined;
    return {
      type: 'TemplateLiteral',
      quasis: quasis?.map(() => ({ type: 'TemplateElement', value: PLACEHOLDERS.TEMPLATE })),
      expressions: expressions?.map((e) => normalizeAst(e, opts, depth + 1)),
    };
  }

  // JSX text → placeholder
  if (nodeType === 'JSXText' && opts.normalizeStrings) {
    return { type: 'JSXText', value: PLACEHOLDERS.STRING };
  }

  // Default: recursively normalize all properties
  return normalizeGenericObject(node, opts, depth);
}

/**
 * Normalize a generic object by processing all properties
 */
function normalizeGenericObject(
  obj: Record<string, unknown>,
  opts: Required<NormalizeOptions>,
  depth: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(obj)) {
    // Skip non-structural keys
    if (SKIP_KEYS.has(key)) continue;

    const value = obj[key];

    // Keep type field as-is (or exclude if not wanted)
    if (key === 'type') {
      if (opts.includeTypes) {
        result[key] = value;
      }
      continue;
    }

    // Recursively normalize
    result[key] = normalizeAst(value, opts, depth + 1);
  }

  return result;
}

/**
 * Convert AST to a sequence of structural tokens
 *
 * Creates a flat token sequence representing the structure,
 * useful for token-based similarity algorithms.
 *
 * @example
 * ```typescript
 * const tokens = astToTokens(ast);
 * // ['FunctionDeclaration', '(', 'Identifier', ')', 'BlockStatement', ...]
 * ```
 */
export function astToTokens(
  node: Node | unknown,
  options: NormalizeOptions = {},
  tokens: string[] = [],
  depth = 0,
): string[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (depth > opts.maxDepth) {
    tokens.push('$MAX');
    return tokens;
  }

  if (node === null || node === undefined) {
    return tokens;
  }

  if (typeof node !== 'object') {
    // Primitives become tokens
    if (typeof node === 'string' && opts.normalizeStrings) {
      tokens.push(PLACEHOLDERS.STRING);
    } else if (typeof node === 'number' && opts.normalizeNumbers) {
      tokens.push(PLACEHOLDERS.NUMBER);
    } else if (typeof node === 'boolean') {
      tokens.push(node ? 'TRUE' : 'FALSE');
    }
    return tokens;
  }

  if (Array.isArray(node)) {
    tokens.push('[');
    for (const item of node) {
      astToTokens(item, opts, tokens, depth + 1);
    }
    tokens.push(']');
    return tokens;
  }

  const obj = node as Record<string, unknown>;
  const nodeType = obj.type as string | undefined;

  if (nodeType) {
    // Add node type as token
    tokens.push(nodeType);

    // Handle special cases
    if (nodeType === 'Identifier' && opts.normalizeIdentifiers) {
      tokens.push(PLACEHOLDERS.IDENTIFIER);
      return tokens;
    }
    if (nodeType === 'StringLiteral' && opts.normalizeStrings) {
      tokens.push(PLACEHOLDERS.STRING);
      return tokens;
    }
    if ((nodeType === 'NumericLiteral' || nodeType === 'NumberLiteral') && opts.normalizeNumbers) {
      tokens.push(PLACEHOLDERS.NUMBER);
      return tokens;
    }
  }

  // Process children
  tokens.push('{');
  for (const key of Object.keys(obj)) {
    if (SKIP_KEYS.has(key) || key === 'type') continue;
    const value = obj[key];
    if (value !== null && value !== undefined) {
      tokens.push(`${key}:`);
      astToTokens(value, opts, tokens, depth + 1);
    }
  }
  tokens.push('}');

  return tokens;
}
