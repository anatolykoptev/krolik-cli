/**
 * @module lib/@ast/fingerprint/fingerprint
 * @description Structural fingerprint generation and comparison
 *
 * Generates fingerprints from code that can be compared to find clones.
 * Uses MD5 hashing of normalized AST structure.
 */

import * as crypto from 'node:crypto';
import { parseSync } from '@swc/core';
import { astToTokens, type NormalizeOptions, normalizeAst } from './normalize';

/**
 * Options for fingerprint generation
 */
export interface FingerprintOptions extends NormalizeOptions {
  /** Use token-based fingerprint instead of AST-based (default: false) */
  tokenBased?: boolean;
  /** Minimum token count for valid fingerprint (default: 10) */
  minTokens?: number;
}

/**
 * Result of fingerprint generation
 */
export interface FingerprintResult {
  /** MD5 hash of the normalized structure */
  fingerprint: string;
  /** Number of structural tokens */
  tokenCount: number;
  /** Structural complexity score (higher = more complex) */
  complexity: number;
  /** Whether the code was too small to fingerprint */
  tooSmall: boolean;
}

/**
 * A group of clones with the same structural fingerprint
 */
export interface CloneGroup {
  /** Shared fingerprint of all clones */
  fingerprint: string;
  /** Structural complexity */
  complexity: number;
  /** Locations of the clones */
  locations: CloneLocation[];
}

/**
 * Location of a clone in the codebase
 */
export interface CloneLocation {
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Function/block name (if available) */
  name?: string;
  /** Original code snippet (truncated) */
  snippet: string;
}

const DEFAULT_OPTIONS: FingerprintOptions = {
  normalizeIdentifiers: true,
  normalizeStrings: true,
  normalizeNumbers: true,
  includeTypes: true,
  maxDepth: 50,
  tokenBased: false,
  minTokens: 10,
};

/**
 * Generate a structural fingerprint from source code
 *
 * @example
 * ```typescript
 * const result1 = generateFingerprint('function foo(x) { return x + 1; }');
 * const result2 = generateFingerprint('function bar(y) { return y + 1; }');
 * // result1.fingerprint === result2.fingerprint (same structure!)
 * ```
 */
export function generateFingerprint(
  code: string,
  options: FingerprintOptions = {},
): FingerprintResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    const ast = parseSync(code, {
      syntax: 'typescript',
      tsx: true,
    });

    return generateFingerprintFromAst(ast, opts);
  } catch {
    // Parse error - return empty fingerprint
    return {
      fingerprint: '',
      tokenCount: 0,
      complexity: 0,
      tooSmall: true,
    };
  }
}

/**
 * Generate a structural fingerprint from an AST node
 *
 * Can be used with any AST node (function, class, block, etc.)
 */
export function generateFingerprintFromAst(
  ast: unknown,
  options: FingerprintOptions = {},
): FingerprintResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (opts.tokenBased) {
    // Token-based fingerprint
    const tokens = astToTokens(ast, opts);
    const tokenCount = tokens.length;

    if (tokenCount < (opts.minTokens ?? 10)) {
      return {
        fingerprint: '',
        tokenCount,
        complexity: calculateComplexity(tokens),
        tooSmall: true,
      };
    }

    const tokenString = tokens.join(' ');
    const fingerprint = crypto.createHash('md5').update(tokenString).digest('hex');

    return {
      fingerprint,
      tokenCount,
      complexity: calculateComplexity(tokens),
      tooSmall: false,
    };
  }

  // AST-based fingerprint (default)
  const normalized = normalizeAst(ast, opts);
  const serialized = JSON.stringify(normalized, null, 0);
  const tokens = astToTokens(ast, opts);
  const tokenCount = tokens.length;

  if (tokenCount < (opts.minTokens ?? 10)) {
    return {
      fingerprint: '',
      tokenCount,
      complexity: calculateComplexity(tokens),
      tooSmall: true,
    };
  }

  const fingerprint = crypto.createHash('md5').update(serialized).digest('hex');

  return {
    fingerprint,
    tokenCount,
    complexity: calculateComplexity(tokens),
    tooSmall: false,
  };
}

/**
 * Compare two fingerprints for similarity
 *
 * Returns 1.0 for identical structures, 0.0 for completely different.
 * For non-identical fingerprints, uses token-based Jaccard similarity.
 */
export function compareFingerprints(
  fp1: FingerprintResult,
  fp2: FingerprintResult,
  code1?: string,
  code2?: string,
): number {
  // Exact match
  if (fp1.fingerprint === fp2.fingerprint) {
    return 1.0;
  }

  // If fingerprints differ but we have code, compute token similarity
  if (code1 && code2) {
    try {
      const tokens1 = new Set(astToTokens(parseSync(code1, { syntax: 'typescript', tsx: true })));
      const tokens2 = new Set(astToTokens(parseSync(code2, { syntax: 'typescript', tsx: true })));

      // Jaccard similarity
      const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
      const union = new Set([...tokens1, ...tokens2]);

      return intersection.size / union.size;
    } catch {
      return 0;
    }
  }

  return 0;
}

/**
 * Find structural clones in a collection of code snippets
 *
 * Groups code by structural fingerprint to find clones.
 *
 * @example
 * ```typescript
 * const snippets = [
 *   { code: 'function foo(x) { return x + 1; }', file: 'a.ts', line: 1, name: 'foo' },
 *   { code: 'function bar(y) { return y + 1; }', file: 'b.ts', line: 5, name: 'bar' },
 * ];
 * const clones = findStructuralClones(snippets);
 * // Returns one CloneGroup with both functions
 * ```
 */
export function findStructuralClones(
  snippets: Array<{
    code: string;
    file: string;
    line: number;
    name?: string;
  }>,
  options: FingerprintOptions = {},
): CloneGroup[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const groups = new Map<string, CloneGroup>();

  for (const snippet of snippets) {
    const result = generateFingerprint(snippet.code, opts);

    if (result.tooSmall || !result.fingerprint) {
      continue;
    }

    const existing = groups.get(result.fingerprint);
    const location: CloneLocation = {
      file: snippet.file,
      line: snippet.line,
      ...(snippet.name && { name: snippet.name }),
      snippet: snippet.code.slice(0, 100),
    };

    if (existing) {
      existing.locations.push(location);
    } else {
      groups.set(result.fingerprint, {
        fingerprint: result.fingerprint,
        complexity: result.complexity,
        locations: [location],
      });
    }
  }

  // Return only groups with 2+ clones, sorted by complexity (most complex first)
  return [...groups.values()]
    .filter((g) => g.locations.length >= 2)
    .sort((a, b) => b.complexity - a.complexity);
}

/**
 * Calculate structural complexity from tokens
 *
 * Higher complexity = more valuable to deduplicate
 */
function calculateComplexity(tokens: string[]): number {
  let complexity = 0;

  // Base complexity from token count
  complexity += Math.log2(tokens.length + 1) * 10;

  // Bonus for control flow
  const controlFlow = [
    'IfStatement',
    'ForStatement',
    'WhileStatement',
    'SwitchStatement',
    'TryStatement',
  ];
  for (const token of tokens) {
    if (controlFlow.includes(token)) {
      complexity += 5;
    }
  }

  // Bonus for function calls (indicates logic)
  const callCount = tokens.filter((t) => t === 'CallExpression').length;
  complexity += callCount * 2;

  // Bonus for nesting (indicated by depth of braces)
  let maxDepth = 0;
  let currentDepth = 0;
  for (const token of tokens) {
    if (token === '{' || token === '[') {
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    } else if (token === '}' || token === ']') {
      currentDepth--;
    }
  }
  complexity += maxDepth * 3;

  return Math.round(complexity);
}
