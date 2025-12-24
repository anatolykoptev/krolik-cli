/**
 * @module commands/status/output
 * @description Status command output formatters
 *
 * @deprecated Import from './output/index' instead
 */

export type { ReportSummary } from './output/index';
// Re-export everything from the new modular structure
export {
  formatAI,
  formatDuration,
  formatJson,
  formatMarkdown,
  formatReportOutput,
  printStatus,
} from './output/index';
