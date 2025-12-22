/**
 * @module commands/quality/recommendations
 * @description Re-exports from recommendations/ folder for backward compatibility
 */

export type {
  Recommendation,
  RecommendationResult,
  RecommendationCategory,
  RecommendationSeverity,
} from './recommendations/index';

export {
  checkRecommendations,
  summarizeRecommendations,
  getTopRecommendations,
  ALL_RECOMMENDATIONS,
  RECOMMENDATIONS,
} from './recommendations/index';
