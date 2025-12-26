/**
 * @module lib/@ast-analysis
 * @description AST analysis utilities for TypeScript source files
 *
 * Provides fast SWC-based analysis of TypeScript/JavaScript files to extract
 * exported functions, classes, methods, and their signatures.
 *
 * @example
 * ```typescript
 * import { analyzeSourceFile } from '@/lib/@ast-analysis';
 *
 * const result = analyzeSourceFile('/path/to/file.ts');
 * if (result.success) {
 *   for (const exp of result.exports) {
 *     console.log(`${exp.kind}: ${exp.name}(${exp.params.map(p => p.name).join(', ')})`);
 *   }
 * }
 * ```
 */

export { analyzeSourceFile, extractTypeString } from './source-analyzer';
export type {
  ExportedMember,
  MethodInfo,
  ParamInfo,
  SourceAnalysisResult,
} from './types';
