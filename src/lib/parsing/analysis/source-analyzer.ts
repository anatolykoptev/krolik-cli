/**
 * @module lib/parsing/analysis/source-analyzer
 * @deprecated Moved to @/lib/discovery/source-analyzer
 *
 * This module has been moved to the discovery layer as it contains domain logic
 * for discovering exports, not low-level parsing infrastructure.
 *
 * Please update your imports:
 * ```typescript
 * // Old (deprecated)
 * import { analyzeSourceFile, ExportedMember } from '@/lib/parsing';
 *
 * // New (recommended)
 * import { analyzeSourceFile, ExportedMember } from '@/lib/discovery/source-analyzer';
 * ```
 */

/**
 * @deprecated Moved to @/lib/discovery/source-analyzer
 */
export {
  analyzeSourceFile,
  type ExportedMember,
  type ExportKind,
  extractTypeString,
  type MethodInfo,
  type ParamInfo,
  type SourceAnalysisResult,
} from '@/lib/discovery/source-analyzer';
