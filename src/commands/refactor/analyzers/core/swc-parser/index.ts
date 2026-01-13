/**
 * @module commands/refactor/analyzers/core/swc-parser
 * @description Fast SWC-based function and type extraction for refactor analysis
 *
 * Uses SWC for 10-20x faster AST parsing compared to ts-morph.
 * Performs syntax-only parsing (no type checking) for maximum speed.
 *
 * IMPORTANT: Uses parseFile from @ast/swc/parser to handle SWC's
 * accumulating span offsets correctly via baseOffset normalization.
 */

// Re-export from @ast/swc for convenience
export { offsetToPosition } from '../../../../../lib/@ast/swc';

// Function extraction
export { extractFunctionsSwc } from './function-extraction';
// Shared utilities (domain-specific)
export { extractTypeText, normalizeSpan, normalizeTypeText } from './shared';
// Type extraction
export { extractTypesSwc } from './type-extraction';
// Types
export type { SwcFunctionInfo, SwcTypeInfo, VisitContext } from './types';
// AST visitors
export { visitNode } from './visitors';
