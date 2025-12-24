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

// Text format
export { printStatus, formatJson } from './text';

// Markdown format
export { formatMarkdown } from './markdown';

// AI/XML format
export { formatAI, formatReportOutput } from './xml';
export type { ReportSummary } from './xml';

// Shared utilities
export { formatDuration } from './shared';
export type { NextAction } from './shared';
