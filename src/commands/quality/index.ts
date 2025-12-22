/**
 * @module commands/quality
 * @description Code quality analysis: SRP, hardcoded values, complexity
 *
 * Usage:
 *   krolik quality                      # Analyze current directory
 *   krolik quality --path=apps/web      # Analyze specific path
 *   krolik quality --ai                 # AI-friendly output
 *   krolik quality --category=srp       # Filter by category
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import type { CommandContext } from '../../types';
import type {
  QualityReport,
  FileAnalysis,
  QualityIssue,
  QualityOptions,
  RecommendationItem,
} from './types';
import { analyzeFile } from './analyzers';
import { checkRecommendations, type RecommendationResult } from './recommendations';
import { formatText, formatAI } from './formatters';

// ============================================================================
// TYPES
// ============================================================================

export type { QualityReport, FileAnalysis, QualityIssue, QualityOptions };

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Extended report with file contents for AI processing
 */
export interface QualityReportWithContents {
  report: QualityReport;
  fileContents: Map<string, string>;
}

/**
 * Run quality analysis on a directory
 */
export async function analyzeQuality(
  projectRoot: string,
  options: QualityOptions = {},
): Promise<QualityReportWithContents> {
  const targetPath = options.path
    ? path.isAbsolute(options.path)
      ? options.path
      : path.join(projectRoot, options.path)
    : projectRoot;

  // Find all TypeScript/JavaScript files
  const patterns = ['**/*.ts', '**/*.tsx'];
  const ignore = [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**',
    '**/*.d.ts',
    '**/generated/**',
  ];

  if (!options.includeTests) {
    ignore.push('**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/__tests__/**');
  }

  const files = await glob(patterns, {
    cwd: targetPath,
    ignore,
    absolute: true,
  });

  // Analyze each file and collect contents
  const analyses: FileAnalysis[] = [];
  const allIssues: QualityIssue[] = [];
  const fileContents = new Map<string, string>();

  for (const file of files) {
    try {
      const analysis = analyzeFile(file, projectRoot, options);
      analyses.push(analysis);
      allIssues.push(...analysis.issues);
      // Store content for AI context - key by both absolute and relative paths
      const content = fs.readFileSync(file, 'utf-8');
      fileContents.set(analysis.path, content);
      fileContents.set(analysis.relativePath, content);
    } catch {
      // Skip files that can't be analyzed
    }
  }

  // Filter issues by category/severity if specified
  let filteredIssues = allIssues;
  if (options.category) {
    filteredIssues = filteredIssues.filter(i => i.category === options.category);
  }
  if (options.severity) {
    filteredIssues = filteredIssues.filter(i => i.severity === options.severity);
  }

  // Calculate summary
  const summary = {
    errors: filteredIssues.filter(i => i.severity === 'error').length,
    warnings: filteredIssues.filter(i => i.severity === 'warning').length,
    infos: filteredIssues.filter(i => i.severity === 'info').length,
    byCategory: {
      srp: filteredIssues.filter(i => i.category === 'srp').length,
      hardcoded: filteredIssues.filter(i => i.category === 'hardcoded').length,
      complexity: filteredIssues.filter(i => i.category === 'complexity').length,
      'mixed-concerns': filteredIssues.filter(i => i.category === 'mixed-concerns').length,
      size: filteredIssues.filter(i => i.category === 'size').length,
      documentation: filteredIssues.filter(i => i.category === 'documentation').length,
      'type-safety': filteredIssues.filter(i => i.category === 'type-safety').length,
      'circular-dep': filteredIssues.filter(i => i.category === 'circular-dep').length,
      lint: filteredIssues.filter(i => i.category === 'lint').length,
    },
  };

  // Top issues sorted by severity
  const topIssues = [...filteredIssues]
    .sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, 20);

  // Find files that need refactoring
  const needsRefactoring: QualityReport['needsRefactoring'] = [];

  for (const analysis of analyses) {
    const fileIssues = analysis.issues.filter(i => i.severity !== 'info');
    if (fileIssues.length >= 2) {
      needsRefactoring.push({
        file: analysis.relativePath,
        reason: fileIssues.map(i => i.category).join(', '),
        suggestions: [...new Set(fileIssues.map(i => i.suggestion).filter(Boolean) as string[])],
      });
    }
  }

  // Sort by number of issues
  needsRefactoring.sort((a, b) => b.suggestions.length - a.suggestions.length);

  // Run recommendation checks
  const allRecommendations: RecommendationResult[] = [];
  for (const analysis of analyses) {
    const content = fs.readFileSync(analysis.path, 'utf-8');
    const recs = checkRecommendations(content, analysis);
    allRecommendations.push(...recs);
  }

  // Aggregate recommendations by id with counts
  const recCounts = new Map<string, { rec: RecommendationResult; count: number }>();
  for (const rec of allRecommendations) {
    const existing = recCounts.get(rec.recommendation.id);
    if (existing) {
      existing.count++;
    } else {
      recCounts.set(rec.recommendation.id, { rec, count: 1 });
    }
  }

  // Convert to RecommendationItem[] sorted by count
  const recommendations: RecommendationItem[] = [...recCounts.values()]
    .sort((a, b) => {
      // Sort by severity first, then by count
      const severityOrder = { 'best-practice': 0, recommendation: 1, suggestion: 2 };
      const sevDiff = severityOrder[a.rec.recommendation.severity] - severityOrder[b.rec.recommendation.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.count - a.count;
    })
    .slice(0, 15)
    .map(({ rec, count }) => ({
      id: rec.recommendation.id,
      title: rec.recommendation.title,
      description: rec.recommendation.description,
      category: rec.recommendation.category,
      severity: rec.recommendation.severity,
      file: rec.file,
      line: rec.line,
      snippet: rec.snippet,
      count,
    }));

  const report: QualityReport = {
    timestamp: new Date().toISOString(),
    projectRoot,
    totalFiles: files.length,
    analyzedFiles: analyses.length,
    summary,
    files: analyses,
    topIssues,
    needsRefactoring: needsRefactoring.slice(0, 10),
    recommendations,
  };

  return { report, fileContents };
}

// ============================================================================
// CLI RUNNER
// ============================================================================

/**
 * Run quality command
 */
export async function runQuality(ctx: CommandContext & { options: QualityOptions }): Promise<void> {
  const { config, options } = ctx;

  const { report, fileContents } = await analyzeQuality(config.projectRoot, options);

  if (options.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  if (options.format === 'ai') {
    // Pass file contents for AI context extraction
    console.log(formatAI(report, fileContents));
    return;
  }

  console.log(formatText(report, options));
}

// Re-export types
export { DEFAULT_THRESHOLDS } from './types';
