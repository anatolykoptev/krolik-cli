/**
 * @module lib/parsing
 * @description AST parsing and analysis infrastructure
 *
 * This module provides high-performance parsing and analysis capabilities:
 * - swc/ - Fast SWC-based TypeScript/JavaScript parsing (10-20x faster than ts-morph)
 * - analysis/ - Source file analysis to extract exports, types, and signatures
 *
 * @example
 * ```typescript
 * // Low-level parsing
 * import { parseFile, visitNodeWithCallbacks } from '@/lib/parsing/swc';
 *
 * const { ast, lineOffsets } = parseFile('src/app.ts', code);
 * visitNodeWithCallbacks(ast, {
 *   onCallExpression: (node, ctx) => { ... }
 * });
 *
 * // High-level analysis
 * import { analyzeSourceFile } from '@/lib/parsing';
 *
 * const result = analyzeSourceFile('/path/to/file.ts');
 * if (result.success) {
 *   for (const exp of result.exports) {
 *     console.log(`${exp.kind}: ${exp.name}`);
 *   }
 * }
 * ```
 */

// Re-export analysis module
export * from './analysis';
// Re-export signatures module
export * from './signatures';
// Re-export SWC module
export * from './swc';
