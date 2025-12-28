/**
 * @module commands/refactor/output/sections
 * @description Section formatters for AI-native XML output
 *
 * Each section is responsible for formatting a specific part of the analysis:
 * - stats: Summary statistics
 * - project-context: Project type and tech stack
 * - architecture: Architecture health and violations
 * - domains: Domain classification
 * - duplicates: Duplicate functions and types
 * - migration: Migration plan and actions
 * - recommendations: Prioritized recommendations
 * - reusable-modules: Reusable module analysis
 * - file-size: Oversized file analysis
 * - navigation: AI navigation hints
 * - ai-config: Namespace configuration and patterns
 */

export { formatAiConfig } from './ai-config';
export { formatArchitectureHealth, formatViolation } from './architecture';
export { formatDomain, formatDomains } from './domains';
export { formatDuplicates } from './duplicates';
export { formatFileSizeAnalysis, formatFileSizeIssue } from './file-size';
export { formatMigration, formatMigrationAction } from './migration';
export { formatAiNavigation } from './navigation';
export { formatProjectContext } from './project-context';
export {
  formatCouplingMetrics,
  formatHotspot,
  formatHotspots,
  formatPhase,
  formatRankingAnalysis,
  formatSafeOrder,
} from './ranking';
export { formatRecommendation, formatRecommendations } from './recommendations';
export {
  formatCategorySummary,
  formatReusableModule,
  formatReusableModules,
} from './reusable-modules';
export { formatStats } from './stats';
