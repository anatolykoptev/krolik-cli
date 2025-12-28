/**
 * @module lib/analysis
 * @description AST analysis utilities for TypeScript source files
 *
 * Provides fast SWC-based analysis of TypeScript/JavaScript files to extract
 * exported functions, classes, types, interfaces, enums, and their signatures.
 *
 * @example
 * ```typescript
 * import { analyzeSourceFile } from '@/lib/analysis';
 *
 * const result = analyzeSourceFile('/path/to/file.ts');
 * if (result.success) {
 *   for (const exp of result.exports) {
 *     console.log(`${exp.kind}: ${exp.name}`);
 *   }
 * }
 * ```
 */

// Re-export commonly used type guards
export {
  isClassDeclaration,
  isFunctionDeclaration,
  isIdentifier,
  isTsEnum,
  isTsInterface,
  isTsTypeAlias,
} from './guards';
export { analyzeSourceFile, extractTypeString } from './source-analyzer';
export type {
  ExportedMember,
  ExportKind,
  MethodInfo,
  ParamInfo,
  SourceAnalysisResult,
} from './types';
