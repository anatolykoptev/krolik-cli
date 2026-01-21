/**
 * @module commands/fix/plan
 * @description Fix plan generation
 */

import { fileCache } from '../../lib/@cache';
import type { ContentProvider } from '../../lib/@reporter/types';
import { analyzeQuality } from './analyze';
import type { FixOperation, FixOptions, QualityIssue, RecommendationItem } from './core';
import { getFixDifficulty, isFixerEnabled } from './core';
import { registry } from './fixers';

// ============================================================================
// TYPES
// ============================================================================

export interface FixPlanItem {
  issue: QualityIssue;
  operation: FixOperation;
  difficulty: 'trivial' | 'safe' | 'risky';
}

export interface FixPlan {
  file: string;
  fixes: FixPlanItem[];
}

export interface SkipStats {
  /** @deprecated Legacy field - no longer incremented after Phase 3 refactoring */
  noStrategy: number;
  noContent: number;
  /** @deprecated Legacy field - no longer incremented after Phase 3 refactoring */
  contextSkipped: number;
  noFix: number;
  /** Count of issues with missing fixerId (should be 0 after Phase 1) */
  noFixer: number;
  categories: Map<string, number>;
}

export interface GeneratePlanResult {
  plans: FixPlan[];
  skipStats: SkipStats;
  totalIssues: number;
  /** Code recommendations (simplify, performance, async patterns, etc.) */
  recommendations: RecommendationItem[];
}

// ============================================================================
// PLAN GENERATION
// ============================================================================

/**
 * Generate fix plan from quality report
 */
export async function generateFixPlan(
  projectRoot: string,
  options: FixOptions,
): Promise<GeneratePlanResult> {
  const qualityOptions: Parameters<typeof analyzeQuality>[1] = {};
  if (options.path) qualityOptions.path = options.path;
  if (options.category) qualityOptions.category = options.category;
  if (options.all) qualityOptions.includeRisky = true;

  const { report, fileContents: _fileContents } = await analyzeQuality(projectRoot, qualityOptions);

  // Collect ALL issues from all files
  const allIssues = collectAllIssues(report.files, options.category);

  // Use fileCache as provider since fileContents map is deprecated
  const contentProvider: ContentProvider = (path) => {
    try {
      return fileCache.get(path);
    } catch {
      return undefined;
    }
  };

  // Generate plans
  const { plans, skipStats } = await generatePlansFromIssues(allIssues, contentProvider, options);

  // Apply limit if specified
  const limitedPlans = applyLimit(plans, options.limit);

  return {
    plans: limitedPlans,
    skipStats,
    totalIssues: allIssues.length,
    recommendations: report.recommendations,
  };
}

/**
 * Collect all issues from file analyses
 */
function collectAllIssues(
  files: Array<{ issues: QualityIssue[] }>,
  categoryFilter?: string,
): QualityIssue[] {
  const allIssues: QualityIssue[] = [];

  for (const fileAnalysis of files) {
    for (const issue of fileAnalysis.issues) {
      if (categoryFilter && issue.category !== categoryFilter) {
        continue;
      }
      allIssues.push(issue);
    }
  }

  return allIssues;
}

/**
 * Generate plans from issues
 */
/**
 * Generate plans from issues
 */
async function generatePlansFromIssues(
  allIssues: QualityIssue[],
  fileContents: Map<string, string> | ContentProvider,
  options: FixOptions,
): Promise<{ plans: FixPlan[]; skipStats: SkipStats }> {
  const plans = new Map<string, FixPlan>();
  const skipStats: SkipStats = {
    noStrategy: 0, // @deprecated
    noContent: 0,
    contextSkipped: 0, // @deprecated
    noFix: 0,
    noFixer: 0,
    categories: new Map(),
  };

  for (const issue of allIssues) {
    await processIssue(issue, options, fileContents, plans, skipStats);
  }

  sortPlans(plans);

  return { plans: [...plans.values()], skipStats };
}

/**
 * Process a single issue and add to plan if applicable
 */
async function processIssue(
  issue: QualityIssue,
  options: FixOptions,
  fileContents: Map<string, string> | ContentProvider,
  plans: Map<string, FixPlan>,
  skipStats: SkipStats,
): Promise<void> {
  if (shouldSkipIssue(issue, options, skipStats)) {
    return;
  }

  const content = getFileContent(issue, fileContents);
  if (!content) {
    skipStats.noContent++;
    return;
  }

  const fixer = getFixerForIssue(issue, skipStats);
  if (!fixer) {
    return;
  }

  // Check if fixer wants to skip this issue
  if (fixer.shouldSkip?.(issue, content)) {
    skipStats.contextSkipped++;
    return;
  }

  const operation = await fixer.fix(issue, content);
  if (!operation) {
    skipStats.noFix++;
    return;
  }

  const difficulty = getFixDifficulty(issue);
  addToPlan(plans, issue, operation, difficulty);
}

/**
 * Check if issue should be skipped based on options and difficulty
 */
function shouldSkipIssue(issue: QualityIssue, options: FixOptions, skipStats: SkipStats): boolean {
  // Track category
  const cat = issue.category;
  skipStats.categories.set(cat, (skipStats.categories.get(cat) || 0) + 1);

  // Filter by difficulty
  const difficulty = getFixDifficulty(issue);
  if (options.trivialOnly && difficulty !== 'trivial') {
    return true;
  }
  if (options.safe && difficulty === 'risky') {
    return true;
  }

  // Filter by fixer flags
  if (!isFixerEnabled(issue, options)) {
    return true;
  }

  return false;
}

/**
 * Get file content from provider or map
 */
function getFileContent(
  issue: QualityIssue,
  fileContents: Map<string, string> | ContentProvider,
): string {
  if (fileContents instanceof Map) {
    return fileContents.get(issue.file) || '';
  }
  if (typeof fileContents === 'function') {
    return fileContents(issue.file) || '';
  }
  return '';
}

/**
 * Resolve fixer for issue
 */
function getFixerForIssue(issue: QualityIssue, skipStats: SkipStats) {
  if (!issue.fixerId) {
    skipStats.noFixer++;
    if (process.env.DEBUG || process.env.KROLIK_DEBUG) {
      console.warn(
        `[krolik] Issue missing fixerId: ${issue.category}/${issue.message} at ${issue.file}:${issue.line}`,
      );
    }
    return null;
  }

  const fixer = registry.get(issue.fixerId);
  if (!fixer) {
    skipStats.noFix++;
    if (process.env.DEBUG || process.env.KROLIK_DEBUG) {
      console.warn(`[krolik] Fixer not found: ${issue.fixerId}`);
    }
    return null;
  }

  return fixer;
}

/**
 * Sort fixes within plans
 */
function sortPlans(plans: Map<string, FixPlan>): void {
  for (const plan of plans.values()) {
    plan.fixes.sort((a, b) => {
      const lineA = a.operation.line ?? 0;
      const lineB = b.operation.line ?? 0;
      return lineB - lineA;
    });
  }
}

/**
 * Add fix to plan
 *
 * Multiple fixes per file are now supported. Fixes are sorted bottom-to-top
 * before application to preserve line number validity. Conflicts are handled
 * by the conflict-detector module.
 */
function addToPlan(
  plans: Map<string, FixPlan>,
  issue: QualityIssue,
  operation: FixOperation,
  difficulty: 'trivial' | 'safe' | 'risky',
): void {
  let plan = plans.get(issue.file);

  if (!plan) {
    plan = { file: issue.file, fixes: [] };
    plans.set(issue.file, plan);
  }

  // Add all fixes - conflict detection is handled by conflict-detector.ts
  plan.fixes.push({ issue, operation, difficulty });
}

/**
 * Apply limit to plans
 */
function applyLimit(plans: FixPlan[], limit?: number): FixPlan[] {
  if (!limit) return plans;

  let count = 0;
  return plans
    .map((plan) => {
      const remaining = limit - count;
      if (remaining <= 0) {
        return { ...plan, fixes: [] };
      }
      count += plan.fixes.length;
      if (plan.fixes.length > remaining) {
        return { ...plan, fixes: plan.fixes.slice(0, remaining) };
      }
      return plan;
    })
    .filter((plan) => plan.fixes.length > 0);
}

// ============================================================================
// FROM AUDIT (--from-audit integration)
// ============================================================================

import * as fs from 'node:fs';

/**
 * Read file contents for issues
 */
function readFileContents(issues: QualityIssue[]): Map<string, string> {
  const fileContents = new Map<string, string>();
  const uniqueFiles = [...new Set(issues.map((i) => i.file))];

  for (const file of uniqueFiles) {
    try {
      if (fs.existsSync(file)) {
        fileContents.set(file, fs.readFileSync(file, 'utf-8'));
      }
    } catch {
      // Skip unreadable files
    }
  }

  return fileContents;
}

/**
 * Generate fix plan from pre-loaded issues (for --from-audit)
 */
export async function generateFixPlanFromIssues(
  _projectRoot: string,
  issues: QualityIssue[],
  options: FixOptions,
): Promise<GeneratePlanResult> {
  // Read file contents for the issues
  const fileContents = readFileContents(issues);

  // Filter by category if specified
  let filteredIssues = issues;
  if (options.category) {
    filteredIssues = issues.filter((i) => i.category === options.category);
  }

  // Generate plans from the issues
  const { plans, skipStats } = await generatePlansFromIssues(filteredIssues, fileContents, options);

  // Apply limit if specified
  const limitedPlans = applyLimit(plans, options.limit);

  return {
    plans: limitedPlans,
    skipStats,
    totalIssues: filteredIssues.length,
    recommendations: [], // No recommendations when loading from cached issues
  };
}
