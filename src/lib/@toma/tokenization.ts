/**
 * @module lib/@toma/tokenization
 * @description Abstract token conversion for Toma-based similarity
 *
 * Converts code into abstract type sequences where identifiers
 * are replaced with type markers (V, F, T, P, M, S, N).
 * This enables semantic comparison regardless of naming.
 */

import { createHash } from 'node:crypto';
import type { AbstractToken, IdentifierSubtype, TokenizationResult } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** TypeScript/JavaScript keywords to preserve as-is */
const KEYWORDS = new Set([
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'of',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

/** Operators to preserve */
const OPERATORS = new Set([
  '+',
  '-',
  '*',
  '/',
  '%',
  '**',
  '++',
  '--',
  '=',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '==',
  '===',
  '!=',
  '!==',
  '<',
  '>',
  '<=',
  '>=',
  '&&',
  '||',
  '!',
  '&',
  '|',
  '^',
  '~',
  '<<',
  '>>',
  '>>>',
  '?',
  ':',
  '??',
  '?.',
  '=>',
  '...',
]);

/** Punctuation to preserve */
const PUNCTUATION = new Set(['(', ')', '{', '}', '[', ']', ',', ';', '.']);

// ============================================================================
// ABSTRACT TYPE MARKERS
// ============================================================================

/**
 * Abstract type markers for different identifier types
 */
const ABSTRACT_MARKERS = {
  VARIABLE: 'V',
  FUNCTION: 'F',
  TYPE: 'T',
  PROPERTY: 'P',
  METHOD: 'M',
  STRING: 'S',
  NUMBER: 'N',
  BOOLEAN: 'B',
  NULL: 'X',
  REGEX: 'R',
} as const;

// ============================================================================
// TOKENIZER
// ============================================================================

/**
 * Tokenize code into abstract token sequence
 */
function tokenize(code: string): AbstractToken[] {
  const tokens: AbstractToken[] = [];

  // Simple tokenizer regex - matches identifiers, numbers, strings, operators
  const tokenRegex =
    /([a-zA-Z_$][a-zA-Z0-9_$]*)|(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|([+\-*/%=<>!&|^~?:]+|\.{3}|\?\.)|([(){}[\],;.])|(\s+)/g;

  let match: RegExpExecArray | null;
  let prevToken: AbstractToken | null = null;

  while ((match = tokenRegex.exec(code)) !== null) {
    const [, identifier, number, string, operator, punctuation, whitespace] = match;

    // Skip whitespace
    if (whitespace) continue;

    let token: AbstractToken;

    if (identifier) {
      token = classifyIdentifier(identifier, prevToken);
    } else if (number) {
      token = {
        type: 'literal',
        abstract: ABSTRACT_MARKERS.NUMBER,
        original: number,
        literalSubtype: 'number',
      };
    } else if (string) {
      token = {
        type: 'literal',
        abstract: ABSTRACT_MARKERS.STRING,
        original: string,
        literalSubtype: 'string',
      };
    } else if (operator && OPERATORS.has(operator)) {
      token = {
        type: 'operator',
        abstract: operator,
        original: operator,
      };
    } else if (punctuation && PUNCTUATION.has(punctuation)) {
      token = {
        type: 'punctuation',
        abstract: punctuation,
        original: punctuation,
      };
    } else {
      // Unknown token, skip
      continue;
    }

    tokens.push(token);
    prevToken = token;
  }

  return tokens;
}

/**
 * Classify identifier based on context
 */
function classifyIdentifier(id: string, prevToken: AbstractToken | null): AbstractToken {
  // Keywords stay as-is
  if (KEYWORDS.has(id)) {
    // Special handling for literal keywords
    if (id === 'true' || id === 'false') {
      return {
        type: 'literal',
        abstract: ABSTRACT_MARKERS.BOOLEAN,
        original: id,
        literalSubtype: 'boolean',
      };
    }
    if (id === 'null') {
      return {
        type: 'literal',
        abstract: ABSTRACT_MARKERS.NULL,
        original: id,
        literalSubtype: 'null',
      };
    }
    if (id === 'undefined') {
      return {
        type: 'literal',
        abstract: ABSTRACT_MARKERS.NULL,
        original: id,
        literalSubtype: 'undefined',
      };
    }
    return {
      type: 'keyword',
      abstract: id,
      original: id,
    };
  }

  // Context-based classification
  let subtype: IdentifierSubtype = 'variable';

  if (prevToken) {
    // After 'function' keyword -> function name
    if (prevToken.type === 'keyword' && prevToken.original === 'function') {
      subtype = 'function';
    }
    // After 'class', 'interface', 'type', 'enum' -> type name
    else if (
      prevToken.type === 'keyword' &&
      ['class', 'interface', 'type', 'enum'].includes(prevToken.original)
    ) {
      subtype = 'type';
    }
    // After '.' -> property or method
    else if (prevToken.type === 'punctuation' && prevToken.original === '.') {
      subtype = 'property'; // Will be refined to method if followed by '('
    }
    // After ':' in type position -> type
    else if (prevToken.type === 'operator' && prevToken.original === ':') {
      subtype = 'type';
    }
  }

  // Type naming convention (PascalCase starting with uppercase)
  if (subtype === 'variable' && /^[A-Z][a-zA-Z0-9]*$/.test(id)) {
    subtype = 'type';
  }

  const abstractMarker = getAbstractMarker(subtype);

  return {
    type: 'identifier',
    abstract: abstractMarker,
    original: id,
    identifierSubtype: subtype,
  };
}

/**
 * Get abstract marker for identifier subtype
 */
function getAbstractMarker(subtype: IdentifierSubtype): string {
  switch (subtype) {
    case 'function':
      return ABSTRACT_MARKERS.FUNCTION;
    case 'type':
      return ABSTRACT_MARKERS.TYPE;
    case 'property':
      return ABSTRACT_MARKERS.PROPERTY;
    case 'method':
      return ABSTRACT_MARKERS.METHOD;
    default:
      return ABSTRACT_MARKERS.VARIABLE;
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Convert code to abstract type sequence
 *
 * @example
 * ```ts
 * const result = abstractTokens('function add(a, b) { return a + b; }');
 * // result.typeSequence = "function F(V,V){return V+V;}"
 * ```
 */
export function abstractTokens(code: string): TokenizationResult {
  const tokens = tokenize(code);
  const typeSequence = toTypeSequence(tokens);
  const sequenceHash = toSequenceHash(typeSequence);

  return { tokens, typeSequence, sequenceHash };
}

/**
 * Convert tokens to type sequence string
 */
export function toTypeSequence(tokens: AbstractToken[]): string {
  return tokens.map((t) => t.abstract).join('');
}

/**
 * Hash type sequence for quick comparison
 */
export function toSequenceHash(sequence: string): string {
  return createHash('md5').update(sequence).digest('hex').slice(0, 16);
}

/**
 * Abstract type definition (interface/type alias)
 * Useful for comparing type structures
 */
export function abstractTypeDefinition(definition: string): TokenizationResult {
  // For type definitions, we also abstract field names
  return abstractTokens(definition);
}
