/**
 * @module commands/refactor/analyzers/i18n
 * @description I18n hardcoded strings analyzer for refactor command
 *
 * Detects hardcoded Russian/English text in React components and
 * generates actionable recommendations for i18n extraction.
 *
 * @example
 * ```typescript
 * import { analyzeI18n } from './analyzers/i18n';
 *
 * const result = await analyzeI18n({
 *   rootPath: projectRoot,
 *   includeJsxText: true,
 *   includeJsxAttributes: true,
 * });
 *
 * console.log(`Found ${result.stats.totalStrings} hardcoded strings`);
 * console.log(`Generated ${result.recommendations.length} recommendations`);
 * ```
 *
 * @see {@link analyzeI18n} - Main analysis function
 * @see {@link generateI18nKey} - Key generation utility
 * @see {@link generateI18nRecommendations} - Recommendation generator
 */

// ============================================================================
// CORE ANALYSIS
// ============================================================================

export { analyzeFileI18n, analyzeI18n, detectLanguage, extractHardcodedStrings } from './analyzer';

// ============================================================================
// KEY GENERATION
// ============================================================================

export {
  detectNamespace,
  generateI18nKey,
  generateKeyFromContent,
  textToKey,
  transliterate,
} from './key-generator';

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

export {
  calculateEffort,
  generateCodeFix,
  generateI18nRecommendations,
  groupByComponent,
} from './recommendations';

// ============================================================================
// TYPES
// ============================================================================

export type {
  AnalysisStatus,
  CodeFix,
  ComponentI18nGroup,
  DetectedLanguage,
  FileI18nAnalysis,
  HardcodedStringInfo,
  I18nAnalysisResult,
  I18nAnalysisStats,
  I18nAnalyzerOptions,
  I18nEffort,
  I18nPriority,
  I18nRecommendation,
  StringContext,
  StringLocation,
  SuggestedI18nKey,
  TextCategory,
} from './types';

export { DEFAULT_I18N_OPTIONS } from './types';
