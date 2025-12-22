/**
 * @module commands/quality/recommendations
 * @description Best practices recommendations system (Airbnb-style)
 */

// Export types
export type {
  Recommendation,
  RecommendationResult,
  RecommendationCategory,
  RecommendationSeverity,
} from './types';

// Export checker functions
export { checkRecommendations, summarizeRecommendations, getTopRecommendations } from './checker';

// Export all rules
export { ALL_RECOMMENDATIONS, ALL_RECOMMENDATIONS as RECOMMENDATIONS } from './rules';

// Export individual rule sets for customization
export {
  NAMING_RULES,
  STRUCTURE_RULES,
  TYPESCRIPT_RULES,
  REACT_RULES,
  PERFORMANCE_RULES,
  IMPORTS_RULES,
  TESTING_RULES,
  ASYNC_RULES,
  SECURITY_RULES,
} from './rules';
