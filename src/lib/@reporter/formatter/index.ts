/**
 * @module lib/@reporter/formatter
 * @description Barrel export for formatter modules
 *
 * This module was split from a single 1173-line file into smaller,
 * focused modules for better maintainability:
 * - shared.ts: Icons, impact, and suggestion formatters
 * - markdown.ts: Markdown report formatter
 * - json.ts: JSON formatter
 * - xml.ts: Main XML formatter (orchestration)
 * - xml-sections.ts: XML section formatters
 * - xml-patterns.ts: Pattern and cluster formatters
 */

// JSON formatters
export { formatAsJson, formatContextJson, formatJson } from './json';

// Markdown formatter
export { formatAsMarkdown } from './markdown';
// Shared utilities
export {
  formatChangeRank,
  formatImpactXml,
  formatSuggestionXml,
  getActionIcon,
  getPriorityIcon,
} from './shared';

// XML formatters
export {
  formatAsProgressiveXml,
  formatAsXml,
  formatIssueClusters,
  formatIssuePatterns,
} from './xml';
