/**
 * @module commands/refactor/analyzers/metrics
 * @description Metrics, scoring, and recommendations
 */

// File size analysis
export {
  analyzeFileSizes,
  DEFAULT_THRESHOLDS as FILE_SIZE_THRESHOLDS,
  quickScanFileSizes,
} from './file-size';
// Recommendations
export {
  calculateTotalImprovement,
  filterByCategory,
  generateRecommendations,
  getAutoFixable,
  groupByCategory,
  sortByPriority,
} from './recommendations';
// Reusable modules
export { analyzeReusableModules, getQuickReusableSummary } from './reusable';
