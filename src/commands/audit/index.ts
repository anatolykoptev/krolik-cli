/**
 * @module commands/audit
 * @description Code quality audit command
 *
 * Performs deep analysis of code quality and generates AUDIT.xml
 * with issues, priorities, hotspots, and action plan.
 */

import * as fs from 'node:fs';
import { saveKrolikFile } from '../../lib/@core/fs';
import type { CommandContext, OutputFormat } from '../../types/commands/base';
import type { FixerRegistry } from '../fix/core/registry';
import type { AIReport } from '../fix/reporter/types';
import { getProjectStatus } from '../status';
import { formatReportOutput, type ReportSummary } from '../status/output';

/**
 * Audit command options
 */
export interface AuditOptions {
  format?: OutputFormat;
  path?: string;
  verbose?: boolean;
  /** Show fix previews for quick wins */
  showFixes?: boolean;
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
 * Read file content safely, returning empty string if file doesn't exist
 */
function readFileContent(filePath: string): string {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
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

  // Generate AI-REPORT.md
  const { relativePath, report } = await generateReport(projectRoot, logger);

  // Get status for context
  const status = getProjectStatus(projectRoot, { fast: false });

  // Extract summary from report
  const summary = extractReportSummary(report, relativePath);

  // Output enhanced AI-friendly format with clear instructions
  console.log(formatReportOutput(status, summary));

  // Show fix previews if requested
  if (options.showFixes) {
    const previews = await generateFixPreviews(report, logger);
    if (previews) {
      console.log('');
      console.log(previews);
    }
  }
}

// Re-export types
export type { AIReport } from '../fix/reporter/types';
