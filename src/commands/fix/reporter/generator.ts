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

import type { ImpactEnricher } from '../../audit/enrichment';
import {
  enrichIssueWithCodeContext,
  getGitContext,
  shouldAttachGitContext,
} from '../../audit/enrichment';
import { clusterIssues } from '../../audit/grouping';
import { generateSuggestion } from '../../audit/suggestions';
import type { QualityIssue, QualityReport } from '../core';
import { generateActionPlan } from './action-plan';
import { buildContext, buildFileContexts } from './file-context';
import { findAIRulesFiles, getGitInfo } from './git-context';
import { enrichIssue, extractHotspots, extractQuickWins, groupByPriority } from './grouping';
import { selectIssuesWithI18nHandling } from './issue-selection';
import {
  computeDuplicates,
  computeRanking,
  computeRecommendations,
  createImpactEnricher,
} from './refactor-analysis';
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
  impactEnricher?: ImpactEnricher,
): AIReport {
  const { maxIssues = 100, includeSnippets = false } = options;

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

  // Enrich selected issues with effort, priority, suggestions, impact, and code context
  const enrichedIssues = selectedIssues.map((issue) => {
    const enriched = enrichIssue(issue, { includeCodeContext: includeSnippets });

    // Add AI-generated suggestion if available
    const content = fileContents?.get(issue.file);
    if (content) {
      const suggestion = generateSuggestion(issue, content);
      if (suggestion) {
        enriched.suggestion = suggestion;
      }
    }

    // Add impact data if enricher is available
    if (impactEnricher) {
      const impactData = impactEnricher.enrichIssue(issue);
      enriched.impact = {
        dependents: impactData.dependentsCount,
        bugHistory: 0, // Not available at issue level
        changeFrequency: 0, // Not available at issue level
        pageRank: 0, // Not exposed in EnrichedImpact
        percentile: impactData.pageRankPercentile,
        riskLevel: impactData.riskLevel,
        dependentFiles: impactData.dependents,
        riskReason: impactData.riskReason,
      };
    }

    // Extract complexity from message if available (e.g., "Cyclomatic complexity 18 > 15")
    const complexityMatch = issue.message.match(/complexity[:\s]+(\d+)/i);
    const complexity = complexityMatch ? parseInt(complexityMatch[1] ?? '0', 10) : undefined;
    if (complexity !== undefined) {
      enriched.complexity = complexity;
    }

    // Add git context for high-complexity or critical issues
    // Get initial hotspot status (false initially, will be determined by git context)
    const isHotspot = false;
    if (shouldAttachGitContext(complexity, enriched.priority, isHotspot)) {
      const gitContext = getGitContext(issue.file, {
        projectRoot: qualityReport.projectRoot,
      });
      enriched.gitContext = gitContext;
    }

    // Add code context (snippet + complexity breakdown) for CRITICAL/HIGH issues
    if (enriched.priority === 'critical' || enriched.priority === 'high') {
      const codeContext = enrichIssueWithCodeContext(issue, 5);
      if (codeContext.snippet || codeContext.complexityBreakdown) {
        enriched.codeContext = codeContext;
      }
    }

    return enriched;
  });

  // Build context
  const context = buildContext(qualityReport.projectRoot);

  // Calculate summary
  const summary = calculateSummary(enrichedIssues);

  // Group by priority
  const groups = groupByPriority(enrichedIssues);

  // Cluster related issues (3+ same category in same file)
  const { clusters: issueClusters } = clusterIssues(enrichedIssues, 3);

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
    ...(issueClusters.length > 0 && { issueClusters }),
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
  const [qualityResult, ranking, recommendations, duplicates, impactEnricher] = await Promise.all([
    analyzeQuality(projectRoot, qualityOptions),
    computeRanking(projectRoot),
    computeRecommendations(projectRoot),
    computeDuplicates(projectRoot),
    createImpactEnricher(projectRoot),
  ]);

  return generateAIReport(
    qualityResult.report,
    options,
    qualityResult.fileContents,
    ranking,
    recommendations,
    duplicates,
    impactEnricher,
  );
}
