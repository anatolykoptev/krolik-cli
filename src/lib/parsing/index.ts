/**
 * @module lib/parsing
 * @description AST parsing infrastructure
 *
 * This module provides high-performance parsing capabilities:
 * - swc/ - Fast SWC-based TypeScript/JavaScript parsing (10-20x faster than ts-morph)
 *
 * @example
 * import { parseFile, visitNodeWithCallbacks } from '@/lib/parsing/swc';
 *
 * const { ast, lineOffsets } = parseFile('src/app.ts', code);
 * visitNodeWithCallbacks(ast, {
 *   onCallExpression: (node, ctx) => { ... }
 * });
 */

// Re-export SWC module
export * from './swc';
