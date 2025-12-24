/**
 * @module commands/status/output
 * @description Status command output formatters
 *
 * @deprecated Import from './output/index' instead
 */

// Re-export everything from the new modular structure
export { printStatus, formatJson, formatMarkdown, formatAI, formatReportOutput, formatDuration } from './output/index';
export type { ReportSummary } from './output/index';
