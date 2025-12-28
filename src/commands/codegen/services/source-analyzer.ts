/**
 * @module commands/codegen/services/source-analyzer
 * @description Re-exports AST analysis utilities from lib/analysis
 *
 * @deprecated Import directly from '@/lib/analysis' instead
 */

// Re-export everything from the lib module for backwards compatibility
export {
  analyzeSourceFile,
  type ExportedMember,
  extractTypeString,
  type MethodInfo,
  type ParamInfo,
  type SourceAnalysisResult,
} from '@/lib/analysis';
