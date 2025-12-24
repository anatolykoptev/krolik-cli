/**
 * @module commands/status/output
 * @description Status output formatters
 *
 * Supports multiple output formats:
 * - text: Human-readable CLI output
 * - json: Machine-readable JSON
 * - markdown: Documentation-friendly markdown
 * - ai/xml: AI-agent friendly structured XML
 */

// Markdown format
export { formatMarkdown } from './markdown';
export type { NextAction } from './shared';
// Shared utilities
export { formatDuration } from './shared';
// Text format
export { formatJson, printStatus } from './text';
export type { ReportSummary } from './xml';
// AI/XML format
export { formatAI, formatReportOutput } from './xml';
