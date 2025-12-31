/**
 * @module lib/@detectors/noise-filter
 * @description Noise Filter Pipeline for AI-friendly reports
 *
 * Google-level 5-stage architecture for filtering noise from code analysis:
 * - Stage 0: Skip Filter (fast path for vendor/dist files)
 * - Stage 1: Generated File Detection (confidence-based)
 * - Stage 2: Semantic Context Filter (intent, domain, complexity)
 * - Stage 3: Content Deduplication (fingerprint-based)
 * - Stage 4: Confidence Scoring (multi-factor)
 *
 * @example
 * ```typescript
 * import { filterNoise } from '@/lib/@detectors/noise-filter';
 *
 * const findings = extractTodos(projectRoot);
 * const { findings: filtered, stats } = filterNoise(findings, {
 *   excludeGenerated: true,
 *   enableSemanticFilter: true,
 *   minConfidence: 0.5,
 * });
 *
 * console.log(`Filtered ${stats.input} → ${stats.output} findings`);
 * ```
 */

// Stage 4: Confidence scoring
export { calculateQuality, isGenericTodo, scoreFindings } from './confidence';
// Stage 3: Deduplication
export { deduplicateFindings, groupByFingerprint } from './deduplication';
// Extractors (for advanced usage)
export {
  // Call graph
  allMakeDifferentCalls,
  // JSX children
  allRenderDifferentComponents,
  // Domain boundaries
  areAllDifferentDomains,
  areDifferentDomains,
  areDifferentRouteSegments,
  type CallGraphResult,
  type CallNode,
  compareCallGraphs,
  type DomainContext,
  type DomainLayer,
  // Intent detection
  detectIntent,
  extractCallGraph,
  extractDomain,
  extractJSXChildren,
  extractRouteSegment,
  type FunctionIntent,
  getCallSignature,
  getDefaultSkipIntents,
  getMainComponent,
  groupByDomain,
  hasSkippableIntent,
  haveSameCalls,
  haveSameJSXChildren,
  type IntentContext,
  type IntentResult,
  isSingleComponentWrapper,
  type JSXChildrenResult,
  shouldSkipIntent,
} from './extractors';
// Stage 1: Generated file detection
export {
  clearGeneratedCache,
  type DetectOptions,
  detectGeneratedFile,
  detectGeneratedFileFromDisk,
  getGeneratedCacheStats,
  isGeneratedFile,
} from './generated';
// Main pipeline
export {
  type ExtendedFilteredResult,
  type ExtendedFilterStats,
  type ExtendedNoiseFilterConfig,
  filterGeneratedFindings,
  filterNoise,
} from './pipeline';
// Stage 2: Semantic filter
export {
  applySemanticFilter,
  DEFAULT_SEMANTIC_CONFIG,
  filterDuplicateGroup,
  filterWithSemantics,
  type SemanticFilterConfig,
  type SemanticFilterResult,
  type SemanticFinding,
} from './stages/semantic';
// Stage 0: Skip filter
export {
  addSkipDir,
  addSkipExtension,
  filterSkippable,
  getSkipConfig,
  isSkippable,
  type SkipResult,
  shouldSkip,
} from './stages/skip';

// Base types
export type {
  DedupResult,
  DuplicateGroup,
  FilteredResult,
  FilterStats,
  Finding,
  GeneratedFileResult,
  GeneratedSignal,
  NoiseFilterConfig,
  ScoredFinding,
  ScoringContext,
} from './types';

export { DEFAULT_NOISE_FILTER_CONFIG } from './types';
