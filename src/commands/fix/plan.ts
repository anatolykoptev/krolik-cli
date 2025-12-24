/**
 * @module commands/fix/plan
 * @description Fix plan generation
 */

import type { FixOptions, FixOperation, QualityIssue } from "./types";
import { getFixDifficulty, isFixerEnabled } from "./types";
import { analyzeQuality } from "./analyze";
import { findStrategyDetailed } from "./strategies";
import { registry } from "./fixers";

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
  if (options.all) qualityOptions.includeRisky = true;

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

    // Filter by difficulty
    const difficulty = getFixDifficulty(issue);
    if (options.trivialOnly && difficulty !== "trivial") {
      continue;
    }
    if (options.safe && difficulty === "risky") {
      continue;
    }

    // Filter by fixer flags (--fix-console, --fix-any, etc.)
    if (!isFixerEnabled(issue, options)) {
      continue;
    }

    // Get file content
    const content = fileContents.get(issue.file) || "";
    if (!content) {
      skipStats.noContent++;
      continue;
    }

    // Try to use fixer from registry first (new architecture)
    let operation: FixOperation | null = null;

    if (issue.fixerId) {
      const fixer = registry.get(issue.fixerId);
      if (fixer) {
        operation = await fixer.fix(issue, content);
      }
    }

    // Fall back to legacy strategies if fixer not available
    if (!operation) {
      const strategyResult = findStrategyDetailed(issue, content);

      if (strategyResult.status === "no-strategy") {
        skipStats.noStrategy++;
        continue;
      }

      if (strategyResult.status === "context-skipped") {
        skipStats.contextSkipped++;
        continue;
      }

      operation = await strategyResult.strategy.generateFix(issue, content);
    }

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

// ============================================================================
// FROM AUDIT (--from-audit integration)
// ============================================================================

import * as fs from "node:fs";

/**
 * Read file contents for issues
 */
function readFileContents(issues: QualityIssue[]): Map<string, string> {
  const fileContents = new Map<string, string>();
  const uniqueFiles = [...new Set(issues.map(i => i.file))];

  for (const file of uniqueFiles) {
    try {
      if (fs.existsSync(file)) {
        fileContents.set(file, fs.readFileSync(file, "utf-8"));
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
    filteredIssues = issues.filter(i => i.category === options.category);
  }

  // Generate plans from the issues
  const { plans, skipStats } = await generatePlansFromIssues(
    filteredIssues,
    fileContents,
    options,
  );

  // Apply limit if specified
  const limitedPlans = applyLimit(plans, options.limit);

  return {
    plans: limitedPlans,
    skipStats,
    totalIssues: filteredIssues.length,
  };
}
