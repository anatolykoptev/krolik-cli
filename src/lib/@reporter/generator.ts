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

import { clusterIssues } from '../../commands/audit/grouping';
import { generateSuggestion } from '../../commands/audit/suggestions';
import type { QualityIssue, QualityReport } from '../../commands/fix/core';
import type { ImpactEnricher } from '../@krolik/enrichment';
import {
  enrichIssueWithCodeContext,
  getGitContext,
  shouldAttachGitContext,
} from '../@krolik/enrichment';
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
  CodeStyleRecommendation,
  ContentProvider,
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
  fileContents?: Map<string, string> | ContentProvider,
  ranking?: RankingSummary,
  recommendations?: RecommendationSummary[],
  duplicates?: DuplicateSummary,
  impactEnricher?: ImpactEnricher,
): AIReport {
  const { maxIssues = 100, includeSnippets = false } = options;

  // Helper to get content
  const getContent = (path: string): string | undefined => {
    if (!fileContents) return undefined;
    if (fileContents instanceof Map) return fileContents.get(path);
    if (typeof fileContents === 'function') return fileContents(path);
    return undefined;
  };

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
    const content = getContent(issue.file);
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

  // Convert quality recommendations to CodeStyleRecommendation format
  const codeStyleRecommendations: CodeStyleRecommendation[] = qualityReport.recommendations.map(
    (rec) => ({
      id: rec.id,
      title: rec.title,
      description: rec.description,
      category: rec.category,
      severity: rec.severity,
      file: rec.file,
      count: rec.count,
      ...(rec.line !== undefined && { line: rec.line }),
      ...(rec.snippet !== undefined && { snippet: rec.snippet }),
      ...(rec.fix && { fix: rec.fix }),
    }),
  );

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
    ...(codeStyleRecommendations.length > 0 && { codeStyleRecommendations }),
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
  const { analyzeQuality } = await import('../../commands/fix/analyze');
  const { fileCache } = await import('../@cache');

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

  // specific content provider using the fileCache (LRU)
  const contentProvider: ContentProvider = (path) => {
    try {
      return fileCache.get(path);
    } catch {
      return undefined;
    }
  };

  return generateAIReport(
    qualityResult.report,
    options,
    contentProvider,
    ranking,
    recommendations,
    duplicates,
    impactEnricher,
  );
}
