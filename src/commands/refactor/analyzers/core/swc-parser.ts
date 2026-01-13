/**
 * @module commands/refactor/analyzers/core/swc-parser
 * @description Re-exports from swc-parser/ module for backwards compatibility
 *
 * @see ./swc-parser/index.ts for the actual implementation
 */

// Re-export from @ast/swc for backwards compatibility
export { offsetToPosition } from '../../../../lib/@ast/swc';
export { extractFunctionsSwc } from './swc-parser/function-extraction';
export { extractTypeText, normalizeSpan, normalizeTypeText } from './swc-parser/shared';
export { extractTypesSwc } from './swc-parser/type-extraction';
export type { SwcFunctionInfo, SwcTypeInfo, VisitContext } from './swc-parser/types';
export { visitNode } from './swc-parser/visitors';
