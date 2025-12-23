/**
 * @module commands/fix/plan
 * @description Fix plan generation
 */

import type { FixOptions, FixOperation, QualityIssue } from "./types";
import { getFixDifficulty } from "./types";
import { analyzeQuality } from "./analyze";
import { findStrategyDetailed } from "./strategies";

// ============================================================================
// TYPES
// ============================================================================

export interface FixPlanItem {
  issue: QualityIssue;
  operation: FixOperation;
  difficulty: "trivial" | "safe" | "risky";
}

export interface FixPlan {
  file: string;
  fixes: FixPlanItem[];
}

export interface SkipStats {
  noStrategy: number;
  noContent: number;
  contextSkipped: number;
  noFix: number;
  categories: Map<string, number>;
}

export interface GeneratePlanResult {
  plans: FixPlan[];
  skipStats: SkipStats;
  totalIssues: number;
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

  const { report, fileContents } = await analyzeQuality(projectRoot, qualityOptions);

  // Collect ALL issues from all files
  const allIssues = collectAllIssues(report.files, options.category);

  // Generate plans
  const { plans, skipStats } = await generatePlansFromIssues(
    allIssues,
    fileContents,
    options,
  );

  // Apply limit if specified
  const limitedPlans = applyLimit(plans, options.limit);

  return {
    plans: limitedPlans,
    skipStats,
    totalIssues: allIssues.length,
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
async function generatePlansFromIssues(
  allIssues: QualityIssue[],
  fileContents: Map<string, string>,
  options: FixOptions,
): Promise<{ plans: FixPlan[]; skipStats: SkipStats }> {
  const plans = new Map<string, FixPlan>();
  const skipStats: SkipStats = {
    noStrategy: 0,
    noContent: 0,
    contextSkipped: 0,
    noFix: 0,
    categories: new Map(),
  };

  for (const issue of allIssues) {
    // Track category
    const cat = issue.category;
    skipStats.categories.set(cat, (skipStats.categories.get(cat) || 0) + 1);

    // Filter by difficulty if trivialOnly
    const difficulty = getFixDifficulty(issue);
    if (options.trivialOnly && difficulty !== "trivial") {
      continue;
    }

    // Get file content
    const content = fileContents.get(issue.file) || "";
    if (!content) {
      skipStats.noContent++;
      continue;
    }

    // Find strategy for this issue
    const strategyResult = findStrategyDetailed(issue, content);

    if (strategyResult.status === "no-strategy") {
      skipStats.noStrategy++;
      continue;
    }

    if (strategyResult.status === "context-skipped") {
      skipStats.contextSkipped++;
      continue;
    }

    // Generate fix operation
    const operation = await strategyResult.strategy.generateFix(issue, content);
    if (!operation) {
      skipStats.noFix++;
      continue;
    }

    // Add to plan - ONE fix per file to avoid conflicts
    addToPlan(plans, issue, operation, difficulty);
  }

  return { plans: [...plans.values()], skipStats };
}

/**
 * Add fix to plan (one per file to avoid conflicts)
 */
function addToPlan(
  plans: Map<string, FixPlan>,
  issue: QualityIssue,
  operation: FixOperation,
  difficulty: "trivial" | "safe" | "risky",
): void {
  let plan = plans.get(issue.file);

  if (!plan) {
    plan = { file: issue.file, fixes: [] };
    plans.set(issue.file, plan);
    plan.fixes.push({ issue, operation, difficulty });
  }
  // Skip additional fixes for this file - user needs to run fix again
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
