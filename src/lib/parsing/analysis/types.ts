/**
 * @module lib/parsing/analysis/types
 * @deprecated Moved to @/lib/discovery/source-analyzer
 *
 * Type definitions have been moved to the discovery layer along with the
 * analyzeSourceFile function.
 *
 * Please update your imports:
 * ```typescript
 * // Old (deprecated)
 * import type { ExportedMember, ParamInfo } from '@/lib/parsing/analysis/types';
 *
 * // New (recommended)
 * import type { ExportedMember, ParamInfo } from '@/lib/discovery/source-analyzer';
 * ```
 */

/**
 * @deprecated Moved to @/lib/discovery/source-analyzer
 */
export type {
  ExportedMember,
  ExportKind,
  MethodInfo,
  ParamInfo,
  SourceAnalysisResult,
} from '@/lib/discovery/source-analyzer';
