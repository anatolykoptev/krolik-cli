/**
 * @module commands/fix/reporter
 * @description AI Report Generator - Phase 4 of the Fixer Roadmap
 *
 * Generates structured reports for AI agents with:
 * - Effort estimation per issue
 * - Priority-based grouping
 * - Quick wins identification
 * - Hotspot file detection
 * - Action plan generation
 *
 * @example
 * ```ts
 * import { generateAIReportFromAnalysis, formatAsMarkdown } from './reporter';
 *
 * const report = await generateAIReportFromAnalysis('/path/to/project');
 * const markdown = formatAsMarkdown(report);
 * fs.writeFileSync('.krolik/AI-REPORT.md', markdown);
 * ```
 */

// Effort estimation
export { aggregateEffort, estimateEffort } from './effort';
// Formatters
export { formatAsJson, formatAsMarkdown, formatAsXml } from './formatter';
// Report generation
export { generateAIReport, generateAIReportFromAnalysis } from './generator';

// Issue grouping
export {
  enrichIssue,
  extractHotspots,
  extractQuickWins,
  groupByCategory,
  groupByFile,
  groupByPriority,
  normalizePath,
} from './grouping';
// Types
export type {
  ActionStep,
  AIReport,
  AIReportOptions,
  AIRuleFile,
  EffortEstimate,
  EffortLevel,
  EnrichedIssue,
  FileContext,
  GitInfo,
  IssueGroup,
  NextActionItem,
  PriorityLevel,
  ReportContext,
  ReportSummary,
} from './types';
export { EFFORT_THRESHOLDS } from './types';
