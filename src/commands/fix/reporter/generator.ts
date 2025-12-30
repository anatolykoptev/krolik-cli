/**
 * @module commands/fix/reporter/generator
 * @description AI Report Generator - creates structured reports for AI agents
 *
 * This module orchestrates report generation using:
 * - git-context: Git and AI rules information
 * - refactor-analysis: Ranking, recommendations, duplicates
 * - issue-selection: Proportional category selection
 * - action-plan: Action steps generation
 * - file-context: File context building
 * - rules: Next action and do-not rules
 * - summary: Report summary calculation
 */

import type { QualityIssue, QualityReport } from '../core';
import { generateActionPlan } from './action-plan';
import { buildContext, buildFileContexts } from './file-context';
import { findAIRulesFiles, getGitInfo } from './git-context';
import { enrichIssue, extractHotspots, extractQuickWins, groupByPriority } from './grouping';
import { selectIssuesWithI18nHandling } from './issue-selection';
import { computeDuplicates, computeRanking, computeRecommendations } from './refactor-analysis';
import { determineNextAction, generateDoNotRules } from './rules';
import { calculateSummary } from './summary';
import type {
  AIReport,
  AIReportOptions,
  BackwardsCompatSummary,
  DuplicateSummary,
  RankingSummary,
  RecommendationSummary,
} from './types';

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate AI Report from quality report
 */
export function generateAIReport(
  qualityReport: QualityReport,
  options: AIReportOptions = {},
  fileContents?: Map<string, string>,
  ranking?: RankingSummary,
  recommendations?: RecommendationSummary[],
  duplicates?: DuplicateSummary,
): AIReport {
  const { maxIssues = 100 } = options;

  // Collect all issues
  const allIssues: QualityIssue[] = [];
  for (const file of qualityReport.files) {
    allIssues.push(...file.issues);
  }

  // Extract backwards-compat issues (separate section, not counted in main issues)
  const backwardsCompatIssues = allIssues.filter((i) => i.category === 'backwards-compat');
  const otherIssues = allIssues.filter((i) => i.category !== 'backwards-compat');

  // Build backwards-compat summary
  const backwardsCompatFiles: BackwardsCompatSummary[] = backwardsCompatIssues.map((issue) => {
    const movedTo = issue.snippet?.replace(/^→ /, '');
    return {
      path: issue.file,
      confidence: parseInt(issue.message.match(/\((\d+)%/)?.[1] || '50', 10),
      reason: issue.message.replace(/^Backwards-compat shim file \(\d+% confidence\): /, ''),
      ...(movedTo && { movedTo }),
      suggestion: issue.suggestion || 'Delete this file and update imports',
    };
  });

  // Select issues with smart i18n handling (excluding backwards-compat)
  const { issues: selectedIssues, excludedI18nCount } = selectIssuesWithI18nHandling(
    otherIssues,
    maxIssues,
  );

  // Enrich selected issues
  const enrichedIssues = selectedIssues.map((issue) => enrichIssue(issue));

  // Build context
  const context = buildContext(qualityReport.projectRoot);

  // Calculate summary
  const summary = calculateSummary(enrichedIssues);

  // Group by priority
  const groups = groupByPriority(enrichedIssues);

  // Generate action plan
  const actionPlan = generateActionPlan(enrichedIssues, fileContents);

  // Extract quick wins and hotspots
  const quickWins = extractQuickWins(enrichedIssues);
  const hotspots = extractHotspots(enrichedIssues);

  // Build file contexts for hotspot files
  const hotspotPaths = new Set(hotspots.map((h) => h.file));
  const filesWithIssues = qualityReport.files
    .filter((f) => {
      const normalizedPath = f.relativePath || f.path;
      return (
        hotspotPaths.has(normalizedPath) ||
        hotspotPaths.has(normalizedPath.replace(/^.*?\/src\//, 'src/'))
      );
    })
    .sort((a, b) => {
      const aHotspot = hotspots.find(
        (h) =>
          h.file === (a.relativePath || a.path) ||
          h.file === (a.relativePath || a.path).replace(/^.*?\/src\//, 'src/'),
      );
      const bHotspot = hotspots.find(
        (h) =>
          h.file === (b.relativePath || b.path) ||
          h.file === (b.relativePath || b.path).replace(/^.*?\/src\//, 'src/'),
      );
      return (bHotspot?.issueCount ?? 0) - (aHotspot?.issueCount ?? 0);
    });

  const fileContexts = fileContents ? buildFileContexts(filesWithIssues, fileContents) : [];

  // Get git info and AI rules
  const git = getGitInfo(qualityReport.projectRoot);
  const aiRules = findAIRulesFiles(qualityReport.projectRoot);

  // Determine next action and rules
  const nextAction = determineNextAction(summary, aiRules);
  const doNot = generateDoNotRules(summary);

  return {
    meta: {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      generatedBy: 'krolik-cli',
    },
    context,
    summary,
    groups,
    actionPlan,
    quickWins,
    hotspots,
    fileContexts,
    nextAction,
    doNot,
    ...(git && { git }),
    ...(aiRules.length > 0 && { aiRules }),
    ...(excludedI18nCount > 0 && { excludedI18nCount }),
    ...(backwardsCompatFiles.length > 0 && { backwardsCompatFiles }),
    ...(ranking && { ranking }),
    ...(recommendations && recommendations.length > 0 && { recommendations }),
    ...(duplicates && { duplicates }),
  };
}

// ============================================================================
// ASYNC GENERATOR
// ============================================================================

/**
 * Generate AI Report from quality analysis
 */
export async function generateAIReportFromAnalysis(
  projectRoot: string,
  options: AIReportOptions = {},
): Promise<AIReport> {
  const { analyzeQuality } = await import('../analyze');

  const qualityOptions: { path?: string; includeTests: boolean } = {
    includeTests: false,
  };
  if (options.path) {
    qualityOptions.path = options.path;
  }

  // Run all analyses in parallel
  const [qualityResult, ranking, recommendations, duplicates] = await Promise.all([
    analyzeQuality(projectRoot, qualityOptions),
    computeRanking(projectRoot),
    computeRecommendations(projectRoot),
    computeDuplicates(projectRoot),
  ]);

  return generateAIReport(
    qualityResult.report,
    options,
    qualityResult.fileContents,
    ranking,
    recommendations,
    duplicates,
  );
}
