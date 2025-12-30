/**
 * @module commands/refactor/analyzers/modules/i18n.types
 * @description Type definitions for I18n analysis
 *
 * Separated from i18n.analyzer.ts to avoid circular dependencies:
 * types-ai.ts needs I18nAnalysisResult but i18n.analyzer.ts imports from registry
 * which imports from core which re-exports types-ai.ts.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * File-level i18n analysis result
 */
export interface FileI18nInfo {
  file: string;
  count: number;
  lines: number[];
}

/**
 * I18n analysis result
 */
export interface I18nAnalysisResult {
  files: FileI18nInfo[];
  totalStrings: number;
  totalFiles: number;
  timestamp: string;
}
