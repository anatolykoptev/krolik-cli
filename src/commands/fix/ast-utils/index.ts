/**
 * @module commands/fix/ast-utils
 * @description AST-based code transformations for fix command
 *
 * This module provides safe code transformations using ts-morph:
 * - Function extraction (reduce complexity)
 * - Nesting reduction (early returns)
 * - File splitting (SRP violations)
 *
 * General AST utilities are in lib/@ast/
 */

// Re-export commonly used utilities from lib for convenience
export {
  createProject,
  createSourceFile,
  parseCode,
} from '../../../lib/@ast';

// Transformations
export { extractFunction } from './extract-function';
export { reduceNesting } from './nesting';
export { splitFile } from './split-file';
// Types
export type {
  ExtractFunctionOptions,
  ExtractFunctionResult,
  ReduceNestingResult,
  SplitConfig,
  SplitFileResult,
} from './types';
