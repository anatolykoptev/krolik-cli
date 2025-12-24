/**
 * @module commands/fix/analyze
 * @description Code quality analysis entry point (moved from quality/)
 *
 * Provides:
 * - analyzeQuality() - main analysis function
 * - QualityReportWithContents - extended report with file contents
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { glob } from "glob";
import type {
  QualityReport,
  FileAnalysis,
  QualityIssue,
  QualityOptions,
  RecommendationItem,
} from "./types";
import { analyzeFile } from "./analyzers";
import {
  checkRecommendations,
  type RecommendationResult,
} from "./recommendations";

// New fixer architecture
import { runFixerAnalysis, type FixerRunnerOptions } from "./core/runner";
import { validatePathWithinProject } from "./core/path-utils";
import { fileCache } from "./core/file-cache";
import "./fixers"; // Auto-register all fixers

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
  let patterns = ["**/*.ts", "**/*.tsx"];
  let searchDir = targetPath;

  // If path points to a specific file, adjust accordingly
  if (isFile) {
    searchDir = path.dirname(targetPath);
    patterns = [path.basename(targetPath)];
  }

  const ignore = [
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/coverage/**",
    "**/*.d.ts",
    "**/generated/**",
  ];

  if (!options.includeTests) {
    ignore.push(
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.spec.ts",
      "**/__tests__/**",
    );
  }

  const files = await glob(patterns, {
    cwd: searchDir,
    ignore,
    absolute: true,
  });

  // Analyze each file and collect contents
  const analyses: FileAnalysis[] = [];
  const allIssues: QualityIssue[] = [];
  const fileContents = new Map<string, string>();

  // Prepare fixer runner options from quality options
  const fixerOptions: FixerRunnerOptions = {
    cliOptions: options as Record<string, unknown>,
    includeRisky: options.includeRisky ?? false,
  };

  for (const file of files) {
    try {
      // Read content once (using cache to avoid repeated reads)
      const content = fileCache.get(file);

      // Run legacy analyzers
      const analysis = analyzeFile(file, projectRoot, options);
      analyses.push(analysis);

      // Run new fixer-based analysis
      const fixerResult = runFixerAnalysis(content, file, fixerOptions);

      // Merge issues (deduplicate by same file:line:message)
      const existingKeys = new Set(
        analysis.issues.map(i => `${i.file}:${i.line}:${i.message}`)
      );

      for (const issue of fixerResult.issues) {
        const key = `${issue.file}:${issue.line}:${issue.message}`;
        if (!existingKeys.has(key)) {
          analysis.issues.push(issue);
        }
      }

      allIssues.push(...analysis.issues);

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
    filteredIssues = filteredIssues.filter(
      (i) => i.category === options.category,
    );
  }
  if (options.severity) {
    filteredIssues = filteredIssues.filter(
      (i) => i.severity === options.severity,
    );
  }

  // Calculate summary
  const summary = {
    errors: filteredIssues.filter((i) => i.severity === "error").length,
    warnings: filteredIssues.filter((i) => i.severity === "warning").length,
    infos: filteredIssues.filter((i) => i.severity === "info").length,
    byCategory: {
      srp: filteredIssues.filter((i) => i.category === "srp").length,
      hardcoded: filteredIssues.filter((i) => i.category === "hardcoded")
        .length,
      complexity: filteredIssues.filter((i) => i.category === "complexity")
        .length,
      "mixed-concerns": filteredIssues.filter(
        (i) => i.category === "mixed-concerns",
      ).length,
      size: filteredIssues.filter((i) => i.category === "size").length,
      documentation: filteredIssues.filter(
        (i) => i.category === "documentation",
      ).length,
      "type-safety": filteredIssues.filter((i) => i.category === "type-safety")
        .length,
      "circular-dep": filteredIssues.filter(
        (i) => i.category === "circular-dep",
      ).length,
      lint: filteredIssues.filter((i) => i.category === "lint").length,
      composite: filteredIssues.filter((i) => i.category === "composite").length,
      agent: filteredIssues.filter((i) => i.category === "agent").length,
      refine: filteredIssues.filter((i) => i.category === "refine").length,
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
  const needsRefactoring: QualityReport["needsRefactoring"] = [];

  for (const analysis of analyses) {
    const fileIssues = analysis.issues.filter((i) => i.severity !== "info");
    if (fileIssues.length >= 2) {
      needsRefactoring.push({
        file: analysis.relativePath,
        reason: fileIssues.map((i) => i.category).join(", "),
        suggestions: [
          ...new Set(
            fileIssues.map((i) => i.suggestion).filter(Boolean) as string[],
          ),
        ],
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
  const recCounts = new Map<
    string,
    { rec: RecommendationResult; count: number }
  >();
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
        "best-practice": 0,
        recommendation: 1,
        suggestion: 2,
      };
      const sevDiff =
        severityOrder[a.rec.recommendation.severity] -
        severityOrder[b.rec.recommendation.severity];
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
