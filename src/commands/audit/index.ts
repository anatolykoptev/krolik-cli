/**
 * @module commands/audit
 * @description Code quality audit command
 *
 * Performs deep analysis of code quality and generates AUDIT.xml
 * with issues, priorities, hotspots, and action plan.
 *
 * Uses:
 * - @cache/fileCache for efficient file reading
 * - @core/time for performance measurement
 */

import { fileCache } from '../../lib/@cache';
import { saveKrolikFile } from '../../lib/@core/fs';
import { formatDuration, measureTimeAsync } from '../../lib/@core/time';
import type { CommandContext, OutputFormat } from '../../types/commands/base';
import type { FixerRegistry } from '../fix/core/registry';
import type { AIReport, EnrichedIssue, IssueGroup } from '../fix/reporter/types';
import { getProjectStatus } from '../status';
import { formatReportOutput, type ReportSummary } from '../status/output';
import { type AuditIntent, filterByIntent, parseIntent } from './filters';
import { formatProgressiveOutput, type OutputLevel } from './output';

/**
 * Audit command options
 */
export interface AuditOptions {
  format?: OutputFormat;
  path?: string;
  verbose?: boolean;
  /** Show fix previews for quick wins */
  showFixes?: boolean;
  /** Filter to specific feature/domain */
  feature?: string;
  /** Filter by mode: all, release, refactor */
  mode?: string;
  /** Output level: summary, default, full */
  outputLevel?: OutputLevel;
}

/**
 * Result of generating a report
 */
interface GenerateReportResult {
  reportPath: string;
  relativePath: string;
  report: AIReport;
}

/**
 * Generate AUDIT.xml using the fix analyzer
 * Also saves JSON version for --from-audit integration
 */
async function generateReport(
  projectRoot: string,
  logger: { info: (msg: string) => void },
): Promise<GenerateReportResult> {
  const { generateAIReportFromAnalysis, formatAsXml } = await import('../fix/reporter');

  logger.info('Analyzing code quality...');
  const report = await generateAIReportFromAnalysis(projectRoot);
  const xmlContent = formatAsXml(report);

  // Save XML report using shared utility
  saveKrolikFile(projectRoot, 'AUDIT.xml', xmlContent);

  // Save JSON version for --from-audit integration in fix command
  saveKrolikFile(projectRoot, 'audit-data.json', JSON.stringify(report, null, 2));

  return {
    reportPath: '.krolik/AUDIT.xml',
    relativePath: '.krolik/AUDIT.xml',
    report,
  };
}

/**
 * Extract summary from AIReport for the output formatter
 */
function extractReportSummary(report: AIReport, relativePath: string): ReportSummary {
  return {
    reportPath: relativePath,
    totalIssues: report.summary.totalIssues,
    autoFixable: report.summary.autoFixableIssues,
    critical: report.summary.byPriority.critical ?? 0,
    high: report.summary.byPriority.high ?? 0,
    medium: report.summary.byPriority.medium ?? 0,
    low: report.summary.byPriority.low ?? 0,
    hotspotFiles: report.hotspots.slice(0, 5).map((h) => h.file),
    quickWins: report.quickWins.length,
    ...(report.excludedI18nCount !== undefined && { excludedI18nCount: report.excludedI18nCount }),
  };
}

/**
 * Read file content safely using cache, returning empty string if file doesn't exist
 */
function readFileContent(filePath: string): string {
  try {
    return fileCache.get(filePath);
  } catch {
    return '';
  }
}

/**
 * Format the diff section of a fix preview
 */
function formatDiffLines(fixOp: { oldCode?: string; newCode?: string; action: string }): string[] {
  const lines: string[] = [];
  lines.push('    <diff>');
  lines.push(`- ${fixOp.oldCode?.trim() ?? ''}`);

  if (fixOp.newCode) {
    lines.push(`+ ${fixOp.newCode.trim()}`);
  } else if (fixOp.action === 'delete-line') {
    lines.push('+ (line removed)');
  }

  lines.push('    </diff>');
  return lines;
}

/**
 * Format a single fix preview entry
 */
function formatFixPreview(
  issue: AIReport['quickWins'][0]['issue'],
  fixOp: { oldCode?: string; newCode?: string; action: string },
): string[] {
  const relativePath = issue.file.replace(/.*\/krolik-cli\//, '');
  const lines: string[] = [];

  lines.push(`  <fix file="${relativePath}:${issue.line || 0}" action="${fixOp.action}">`);
  lines.push(`    <message>${issue.message}</message>`);
  lines.push(...formatDiffLines(fixOp));
  lines.push('  </fix>');
  lines.push('');

  return lines;
}

/**
 * Try to generate a fix preview for a single quick win issue
 * Returns the formatted lines if successful, null otherwise
 */
async function tryGeneratePreview(
  issue: AIReport['quickWins'][0]['issue'],
  registry: FixerRegistry,
): Promise<string[] | null> {
  if (!issue.fixerId) {
    return null;
  }

  const fixer = registry.get(issue.fixerId);
  if (!fixer) {
    return null;
  }

  const content = readFileContent(issue.file);
  if (!content) {
    return null;
  }

  try {
    const fixOp = (await fixer.fix(
      {
        file: issue.file,
        ...(issue.line !== undefined && { line: issue.line }),
        severity: 'warning',
        category: issue.category,
        message: issue.message,
        ...(issue.snippet !== undefined && { snippet: issue.snippet }),
        ...(issue.fixerId !== undefined && { fixerId: issue.fixerId }),
      },
      content,
    )) as { oldCode?: string; newCode?: string; action: string } | null;

    if (!fixOp?.oldCode) {
      return null;
    }

    return formatFixPreview(issue, fixOp);
  } catch {
    return null;
  }
}

/**
 * Apply intent filter to an AIReport
 * Filters groups, quickWins, hotspots, and actionPlan
 */
function applyIntentFilter(report: AIReport, intent: AuditIntent): AIReport {
  // Filter enriched issues within groups
  const filterEnrichedIssues = (issues: EnrichedIssue[]): EnrichedIssue[] => {
    const qualityIssues = issues.map((ei) => ei.issue);
    const filtered = filterByIntent(qualityIssues, intent);
    const filteredFiles = new Set(filtered.map((i) => `${i.file}:${i.line}`));
    return issues.filter((ei) => filteredFiles.has(`${ei.issue.file}:${ei.issue.line}`));
  };

  // Filter groups
  const filteredGroups: IssueGroup[] = report.groups
    .map((group) => {
      const filteredIssues = filterEnrichedIssues(group.issues);
      if (filteredIssues.length === 0) return null;
      return {
        ...group,
        issues: filteredIssues,
        count: filteredIssues.length,
        autoFixableCount: filteredIssues.filter((i) => i.autoFixable).length,
      };
    })
    .filter((g): g is IssueGroup => g !== null);

  // Filter quick wins
  const filteredQuickWins = filterEnrichedIssues(report.quickWins);

  // Filter hotspots (by file matching)
  const filteredIssueFiles = new Set(
    filteredGroups.flatMap((g) => g.issues.map((i) => i.issue.file)),
  );
  const filteredHotspots = report.hotspots.filter((h) => filteredIssueFiles.has(h.file));

  // Filter action plan
  const filteredActionPlan = report.actionPlan.filter((step) => filteredIssueFiles.has(step.file));

  // Recalculate summary
  const totalIssues = filteredGroups.reduce((sum, g) => sum + g.count, 0);
  const autoFixableIssues = filteredGroups.reduce((sum, g) => sum + g.autoFixableCount, 0);

  // Recalculate byPriority
  const byPriority: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const group of filteredGroups) {
    for (const issue of group.issues) {
      byPriority[issue.priority] = (byPriority[issue.priority] ?? 0) + 1;
    }
  }

  // Recalculate byCategory
  const byCategory: Record<string, number> = {};
  for (const group of filteredGroups) {
    for (const issue of group.issues) {
      byCategory[issue.issue.category] = (byCategory[issue.issue.category] ?? 0) + 1;
    }
  }

  return {
    ...report,
    groups: filteredGroups,
    quickWins: filteredQuickWins,
    hotspots: filteredHotspots,
    actionPlan: filteredActionPlan,
    summary: {
      ...report.summary,
      totalIssues,
      autoFixableIssues,
      manualIssues: totalIssues - autoFixableIssues,
      byPriority: byPriority as AIReport['summary']['byPriority'],
      byCategory,
    },
  };
}

/**
 * Generate fix previews for quick wins
 */
async function generateFixPreviews(
  report: AIReport,
  _logger: { info: (msg: string) => void },
): Promise<string> {
  if (report.quickWins.length === 0) {
    return '';
  }

  const { registry } = await import('../fix/fixers');
  const lines: string[] = [];
  const maxPreviews = 10;
  let previewCount = 0;

  lines.push('<fix-previews>');
  lines.push('  <info>Auto-fixable issues with diff previews</info>');
  lines.push('');

  for (const win of report.quickWins) {
    if (previewCount >= maxPreviews) {
      const remaining = report.quickWins.length - previewCount;
      lines.push(`  <note>... and ${remaining} more auto-fixable issues</note>`);
      break;
    }

    const previewLines = await tryGeneratePreview(win.issue, registry);
    if (previewLines) {
      lines.push(...previewLines);
      previewCount++;
    }
  }

  lines.push('</fix-previews>');

  return previewCount > 0 ? lines.join('\n') : '';
}

/**
 * Run audit command
 */
export async function runAudit(ctx: CommandContext & { options: AuditOptions }): Promise<void> {
  const { config, logger, options } = ctx;
  const projectRoot = options.path || config.projectRoot;

  // Generate AI-REPORT.md with timing
  const { result: reportResult, durationMs } = await measureTimeAsync(() =>
    generateReport(projectRoot, logger),
  );
  const { relativePath, report: rawReport } = reportResult;

  // Log analysis duration
  logger.info(`Analysis completed in ${formatDuration(durationMs)}`);

  // Apply intent filter if specified
  const intent = parseIntent({ feature: options.feature, mode: options.mode });
  const report = intent ? applyIntentFilter(rawReport, intent) : rawReport;

  // Log filter info if applied
  if (intent) {
    const filterInfo: string[] = [];
    if (intent.feature) filterInfo.push(`feature: ${intent.feature}`);
    if (intent.mode !== 'all') filterInfo.push(`mode: ${intent.mode}`);
    logger.info(`Filtering by ${filterInfo.join(', ')}`);
  }

  // Get output level
  const outputLevel = options.outputLevel || 'default';

  // For progressive output (summary or explicit level)
  if (outputLevel === 'summary' || outputLevel === 'full') {
    const progressiveOutput = formatProgressiveOutput(report, outputLevel);
    console.log(progressiveOutput);
  } else {
    // Default: show status + summary + progressive top issues
    const status = getProjectStatus(projectRoot, { fast: false });
    const summary = extractReportSummary(report, relativePath);
    console.log(formatReportOutput(status, summary));
    console.log('');
    console.log(formatProgressiveOutput(report, 'default'));
  }

  // Show fix previews if requested
  if (options.showFixes) {
    const previews = await generateFixPreviews(report, logger);
    if (previews) {
      console.log('');
      console.log(previews);
    }
  }

  // Log cache stats in verbose mode
  if (options.verbose) {
    const cacheStats = fileCache.getStats();
    if (cacheStats.hits > 0 || cacheStats.misses > 0) {
      const hitRate = ((cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100).toFixed(0);
      logger.info(
        `File cache: ${cacheStats.hits} hits, ${cacheStats.misses} misses (${hitRate}% hit rate)`,
      );
    }
  }
}

// Re-export types
export type { AIReport } from '../fix/reporter/types';
