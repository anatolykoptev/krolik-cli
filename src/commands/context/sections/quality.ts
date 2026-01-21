/**
 * @module commands/context/sections/quality
 * @description Quality audit integration for context
 */

import * as path from 'node:path';
import type { AiContextData } from '../types';

/**
 * Add quality issues from audit analysis
 */
export async function addQualityIssues(
  projectRoot: string,
  relatedFiles: string[],
  aiData: AiContextData,
): Promise<void> {
  try {
    const { generateAIReportFromAnalysis } = await import('@/lib/@reporter');

    // Generate audit report
    const report = await generateAIReportFromAnalysis(projectRoot);

    // Filter issues to related files only (if we have related files)
    const relatedSet = new Set(relatedFiles.map((f) => path.resolve(projectRoot, f)));
    const allIssues = report.quickWins ? report.quickWins.map((qw) => qw.issue) : [];

    const filteredIssues =
      relatedSet.size > 0
        ? allIssues.filter((issue) => relatedSet.has(issue.file))
        : allIssues.slice(0, 20); // Limit to 20 if no filter

    // Convert to context format
    aiData.qualityIssues = filteredIssues.map((issue) => ({
      file: issue.file.replace(`${projectRoot}/`, ''),
      ...(issue.line !== undefined && { line: issue.line }),
      category: issue.category,
      message: issue.message,
      severity: issue.severity,
      autoFixable: Boolean(issue.fixerId),
      ...(issue.fixerId !== undefined && { fixerId: issue.fixerId }),
    }));

    // Add summary
    const byCategory: Record<string, number> = {};
    for (const issue of filteredIssues) {
      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
    }

    aiData.qualitySummary = {
      totalIssues: filteredIssues.length,
      autoFixable: filteredIssues.filter((i) => i.fixerId).length,
      byCategory,
    };
  } catch (error) {
    if (process.env.DEBUG) {
      console.error('[context] Audit analysis failed:', error);
    }
  }
}
