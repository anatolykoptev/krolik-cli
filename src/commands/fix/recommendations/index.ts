/**
 * @module commands/quality/recommendations
 * @description Best practices recommendations system (Airbnb-style)
 */

// Export checker functions
export { checkRecommendations, getTopRecommendations, summarizeRecommendations } from './checker';
// Export all rules
// Export individual rule sets for customization
export {
  ALL_RECOMMENDATIONS,
  ALL_RECOMMENDATIONS as RECOMMENDATIONS,
  ASYNC_RULES,
  IMPORTS_RULES,
  NAMING_RULES,
  PERFORMANCE_RULES,
  REACT_RULES,
  SECURITY_RULES,
  SIMPLIFY_RULES,
  STRUCTURE_RULES,
  TESTING_RULES,
  TYPESCRIPT_RULES,
} from './rules';
// Export types
export type {
  Recommendation,
  RecommendationCategory,
  RecommendationResult,
  RecommendationSeverity,
} from './types';
