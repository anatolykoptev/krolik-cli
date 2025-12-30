/**
 * @module commands/fix/analyze
 * @description Code quality analysis entry point (moved from quality/)
 *
 * Provides:
 * - analyzeQuality() - main analysis function
 * - QualityReportWithContents - extended report with file contents
 *
 * Architecture:
 * - Uses unified-swc.ts for single-pass AST analysis (lint, type-safety, security, etc.)
 * - Issues from unified analyzer have fixerId set, enabling direct fixer lookup
 * - No longer runs separate fixer analysis (eliminated double analysis)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import { fileCache, validatePathWithinProject } from '@/lib';
import { getIgnorePatterns } from '@/lib/@core/constants';
import { detectBackwardsCompat } from '@/lib/@detectors';
import { analyzeFile } from './analyzers';
import type {
  FileAnalysis,
  QualityIssue,
  QualityOptions,
  QualityReport,
  RecommendationItem,
} from './core';
import { runFixerAnalysis } from './core/runner';
import { checkRecommendations, type RecommendationResult } from './recommendations';
import './fixers'; // Auto-register all fixers

const TOP_RECOMMENDATIONS_LIMIT = 15;
const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// TYPES
// ============================================================================

/**
 * Extended report with file contents for AI processing
 */
export interface QualityReportWithContents {
  report: QualityReport;
  fileContents: Map<string, string>;
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/**
 * Run quality analysis on a directory
 */
export async function analyzeQuality(
  projectRoot: string,
  options: QualityOptions = {},
): Promise<QualityReportWithContents> {
  // Validate and resolve target path (security: prevent path traversal)
  let targetPath: string;

  if (options.path) {
    const validation = validatePathWithinProject(projectRoot, options.path);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    targetPath = validation.resolved;
  } else {
    targetPath = projectRoot;
  }

  // Check if target is a file or directory
  const targetStats = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;
  const isFile = targetStats?.isFile() ?? false;

  // Find all TypeScript/JavaScript files
  let patterns = ['**/*.ts', '**/*.tsx'];
  let searchDir = targetPath;

  // If path points to a specific file, adjust accordingly
  if (isFile) {
    searchDir = path.dirname(targetPath);
    patterns = [path.basename(targetPath)];
  }

  // Use centralized ignore patterns from lib/constants/ignore.ts
  const ignore = getIgnorePatterns({ includeTests: options.includeTests });

  const files = await glob(patterns, {
    cwd: searchDir,
    ignore,
    absolute: true,
  });

  // Analyze each file and collect contents
  const analyses: FileAnalysis[] = [];
  const allIssues: QualityIssue[] = [];
  const fileContents = new Map<string, string>();

  // Note: The unified-swc analyzer handles most categories (lint, type-safety, security, etc.)
  // Additional fixer analyzers (like i18n) are run separately for their specific categories.

  for (const file of files) {
    try {
      // Read content once (using cache to avoid repeated reads)
      const content = fileCache.get(file);
      const relativePath = path.relative(projectRoot, file);

      // Run unified analyzer (includes lint, type-safety, security, modernization, hardcoded)
      // All issues from unified-swc now have fixerId set for direct fixer lookup
      const analysis = analyzeFile(file, projectRoot, options);
      analyses.push(analysis);

      allIssues.push(...analysis.issues);

      // Run additional fixer analyzers not covered by unified-swc
      // These include: i18n (hardcoded text detection)
      // Only run if category filter matches or no filter is set
      if (!options.category || options.category === 'i18n') {
        const { issues: fixerIssues } = runFixerAnalysis(content, relativePath, {
          category: 'i18n',
          // Include risky fixers when explicitly requesting i18n category
          includeRisky: options.category === 'i18n' || options.includeRisky === true,
        });
        // Add fixer issues to the file analysis
        for (const issue of fixerIssues) {
          // Ensure file path is relative
          issue.file = relativePath;
          analysis.issues.push(issue);
          allIssues.push(issue);
        }
      }

      // Detect backwards-compatibility shim files
      // These are deprecated re-export files that should be deleted
      if (!options.category || options.category === 'backwards-compat') {
        const bcDetection = detectBackwardsCompat(content, relativePath);
        if (bcDetection.isShim) {
          const bcIssue: QualityIssue = {
            file: relativePath,
            line: bcDetection.deprecatedLines[0] || 1,
            severity: 'warning',
            category: 'backwards-compat',
            message: `Backwards-compat shim file (${bcDetection.confidence}% confidence): ${bcDetection.reason}`,
            suggestion: bcDetection.suggestion,
          };

          // Only add snippet if movedTo is defined
          if (bcDetection.movedTo) {
            bcIssue.snippet = `→ ${bcDetection.movedTo}`;
          }

          analysis.issues.push(bcIssue);
          allIssues.push(bcIssue);
        }
      }

      // Store content for AI context - key by both absolute and relative paths
      fileContents.set(analysis.path, content);
      fileContents.set(analysis.relativePath, content);
    } catch {
      // Skip files that can't be analyzed
    }
  }

  // Filter issues by category/severity if specified
  let filteredIssues = allIssues;
  if (options.category) {
    filteredIssues = filteredIssues.filter((i) => i.category === options.category);
  }
  if (options.severity) {
    filteredIssues = filteredIssues.filter((i) => i.severity === options.severity);
  }

  // Calculate summary
  const summary = {
    errors: filteredIssues.filter((i) => i.severity === 'error').length,
    warnings: filteredIssues.filter((i) => i.severity === 'warning').length,
    infos: filteredIssues.filter((i) => i.severity === 'info').length,
    byCategory: {
      srp: filteredIssues.filter((i) => i.category === 'srp').length,
      hardcoded: filteredIssues.filter((i) => i.category === 'hardcoded').length,
      complexity: filteredIssues.filter((i) => i.category === 'complexity').length,
      'mixed-concerns': filteredIssues.filter((i) => i.category === 'mixed-concerns').length,
      size: filteredIssues.filter((i) => i.category === 'size').length,
      documentation: filteredIssues.filter((i) => i.category === 'documentation').length,
      'type-safety': filteredIssues.filter((i) => i.category === 'type-safety').length,
      'circular-dep': filteredIssues.filter((i) => i.category === 'circular-dep').length,
      lint: filteredIssues.filter((i) => i.category === 'lint').length,
      composite: filteredIssues.filter((i) => i.category === 'composite').length,
      agent: filteredIssues.filter((i) => i.category === 'agent').length,
      refine: filteredIssues.filter((i) => i.category === 'refine').length,
      security: filteredIssues.filter((i) => i.category === 'security').length,
      modernization: filteredIssues.filter((i) => i.category === 'modernization').length,
      i18n: filteredIssues.filter((i) => i.category === 'i18n').length,
      'backwards-compat': filteredIssues.filter((i) => i.category === 'backwards-compat').length,
    },
  };

  // Top issues sorted by severity
  const topIssues = [...filteredIssues]
    .sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 };
      return order[a.severity] - order[b.severity];
    })
    .slice(0, DEFAULT_PAGE_SIZE);

  // Find files that need refactoring
  const needsRefactoring: QualityReport['needsRefactoring'] = [];

  for (const analysis of analyses) {
    const fileIssues = analysis.issues.filter((i) => i.severity !== 'info');
    if (fileIssues.length >= 2) {
      needsRefactoring.push({
        file: analysis.relativePath,
        reason: fileIssues.map((i) => i.category).join(', '),
        suggestions: [...new Set(fileIssues.map((i) => i.suggestion).filter(Boolean) as string[])],
      });
    }
  }

  // Sort by number of issues
  needsRefactoring.sort((a, b) => b.suggestions.length - a.suggestions.length);

  // Run recommendation checks
  const allRecommendations: RecommendationResult[] = [];
  for (const analysis of analyses) {
    const content = fileCache.get(analysis.path);
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
      const severityOrder = {
        'best-practice': 0,
        recommendation: 1,
        suggestion: 2,
      };
      const sevDiff =
        severityOrder[a.rec.recommendation.severity] - severityOrder[b.rec.recommendation.severity];
      if (sevDiff !== 0) return sevDiff;
      return b.count - a.count;
    })
    .slice(0, TOP_RECOMMENDATIONS_LIMIT)
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
