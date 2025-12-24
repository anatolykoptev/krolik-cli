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

// Types
export type {
  EffortLevel,
  EffortEstimate,
  PriorityLevel,
  EnrichedIssue,
  IssueGroup,
  ReportSummary,
  ReportContext,
  ActionStep,
  AIReport,
  AIReportOptions,
  FileContext,
  GitInfo,
  AIRuleFile,
  NextActionItem,
} from './types';

export { EFFORT_THRESHOLDS } from './types';

// Effort estimation
export { estimateEffort, aggregateEffort } from './effort';

// Issue grouping
export {
  enrichIssue,
  groupByFile,
  groupByCategory,
  groupByPriority,
  extractQuickWins,
  extractHotspots,
  normalizePath,
} from './grouping';

// Report generation
export { generateAIReport, generateAIReportFromAnalysis } from './generator';

// Formatters
export { formatAsMarkdown, formatAsJson, formatAsXml } from './formatter';
