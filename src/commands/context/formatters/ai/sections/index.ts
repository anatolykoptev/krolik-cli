/**
 * @module commands/context/formatters/ai/sections
 * @description Re-exports all section formatters
 *
 * Context Modes:
 * - minimal: Ultra-compact (~1500 tokens) - summary, git, memory only
 * - quick: Compact (~3500 tokens) - adds repo-map, schema, routes
 * - deep/full: All sections
 *
 * Section priority for AI efficiency:
 * P0 (Critical): summary, constraints, task
 * P1 (High): changed-files, repo-map, schema, routes
 * P2 (Medium): memory, lib-modules, architecture
 * P3 (Low): tree, types, imports, env-vars
 */

export {
  formatApiContractsSection,
  formatDbRelationsSection,
  formatEnvVarsSection,
  formatImportGraphSection,
  formatRepoMapSection,
} from './advanced-analysis';
// Note: Minimal mode formatters moved to lib/@context-optimizer
export { formatArchitectureSection } from './architecture';
// P0: Critical constraints - goes after summary
export { formatConstraintsSection } from './constraints';
export {
  formatApproachSection,
  formatComponentsSection,
  formatHintsSection,
  formatLibraryDocsSection,
  formatMemorySection,
  formatNextActionsSection,
  formatPreCommitSection,
  formatQualitySection,
  formatTestsSection,
  formatTodosSection,
} from './details';
// P1: Entry points and data flow - shows WHERE to start reading code
export { formatDataFlowSection, formatEntryPointsSection } from './entrypoints';
export { formatFilesSection, formatIoSchemasSection } from './files';
export { formatLibModulesSection } from './lib-modules';
// P0: Quick reference - goes FIRST for immediate agent guidance
export { formatQuickRefSection } from './quick-ref';
export {
  formatRoutesSection,
  formatRoutesSummarySection,
  formatSchemaHighlightsSection,
  formatSchemaSection,
} from './schema-routes';
// Search results - from --search option
export { formatSearchResultsSection } from './search-results';
// P0: Executive summary - goes FIRST
export { formatSummarySection } from './summary';
export {
  formatGitHubIssuesSection,
  formatGitSection,
  formatTaskSection,
  formatTreeSection,
} from './task-git';
export { formatImportsSection, formatTypesSection } from './types-imports';
