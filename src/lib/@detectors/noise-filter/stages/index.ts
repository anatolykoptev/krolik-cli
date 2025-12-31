/**
 * @module lib/@detectors/noise-filter/stages
 * @description Pipeline Stages
 *
 * 5-stage noise filtering pipeline:
 * - Stage 0: Skip Filter (fast path)
 * - Stage 1: Generated File Filter
 * - Stage 2: Semantic Context Filter
 * - Stage 3: Content Deduplicator
 * - Stage 4: Confidence Scoring
 */

// Stage 2: Semantic Filter
export {
  applySemanticFilter,
  DEFAULT_SEMANTIC_CONFIG,
  filterDuplicateGroup,
  filterWithSemantics,
  type SemanticFilterConfig,
  type SemanticFilterResult,
  type SemanticFinding,
} from './semantic';
// Stage 0: Skip Filter
export {
  addSkipDir,
  addSkipExtension,
  filterSkippable,
  getSkipConfig,
  isSkippable,
  type SkipResult,
  shouldSkip,
} from './skip';
