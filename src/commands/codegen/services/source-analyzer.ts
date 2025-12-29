/**
 * @module commands/codegen/services/source-analyzer
 * @description Re-exports AST analysis utilities from lib/parsing
 *
 * @deprecated Import directly from '@/lib/@ast' or '@/lib/@ast/swc' instead
 */

// Re-export analysis types and functions
export {
  analyzeSourceFile,
  type ExportedMember,
  type MethodInfo,
  type ParamInfo,
  type SourceAnalysisResult,
} from '@/lib/@ast';

// Re-export SWC utility separately (not in main @ast export to avoid conflicts)
export { extractTypeString } from '@/lib/@ast/swc';
