/**
 * @module commands/refactor/analyzers/core
 * @description Core analyzers for duplicate detection and AST parsing
 */

// Function duplicates
export {
  extractFunctions,
  type FindDuplicatesOptions,
  findDuplicates,
  quickScanDuplicates,
} from './duplicates';
// SWC Parser
export { extractFunctionsSwc, type SwcFunctionInfo } from './swc-parser';

// Type duplicates
export {
  extractTypes,
  type FindTypeDuplicatesOptions,
  findTypeDuplicates,
  quickScanTypeDuplicates,
  type TypeDuplicateInfo,
  type TypeSignature,
} from './type-duplicates';
