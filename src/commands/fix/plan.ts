/**
 * @module commands/fix/plan
 * @description Fix plan generation
 */

import { analyzeQuality } from './analyze';
import type { FixOperation, FixOptions, QualityIssue } from './core';
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
  const { plans, skipStats } = await generatePlansFromIssues(allIssues, fileContents, options);

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
    noStrategy: 0, // @deprecated - kept for backward compatibility
    noContent: 0,
    contextSkipped: 0, // @deprecated - kept for backward compatibility
    noFix: 0,
    noFixer: 0,
    categories: new Map(),
  };

  for (const issue of allIssues) {
    // Track category
    const cat = issue.category;
    skipStats.categories.set(cat, (skipStats.categories.get(cat) || 0) + 1);

    // Filter by difficulty
    const difficulty = getFixDifficulty(issue);
    if (options.trivialOnly && difficulty !== 'trivial') {
      continue;
    }
    if (options.safe && difficulty === 'risky') {
      continue;
    }

    // Filter by fixer flags (--fix-console, --fix-any, etc.)
    if (!isFixerEnabled(issue, options)) {
      continue;
    }

    // Get file content
    const content = fileContents.get(issue.file) || '';
    if (!content) {
      skipStats.noContent++;
      continue;
    }

    // Get fixer from registry (Phase 3: fixer-only architecture)
    let operation: FixOperation | null = null;

    if (!issue.fixerId) {
      // After Phase 1, all issues should have fixerId
      // Log warning if missing - indicates incomplete migration
      skipStats.noFixer++;
      if (process.env.DEBUG || process.env.KROLIK_DEBUG) {
        console.warn(
          `[krolik] Issue missing fixerId: ${issue.category}/${issue.message} at ${issue.file}:${issue.line}`,
        );
      }
      continue;
    }

    const fixer = registry.get(issue.fixerId);
    if (!fixer) {
      // Fixer not found in registry - should not happen
      skipStats.noFix++;
      if (process.env.DEBUG || process.env.KROLIK_DEBUG) {
        console.warn(`[krolik] Fixer not found: ${issue.fixerId}`);
      }
      continue;
    }

    operation = await fixer.fix(issue, content);

    if (!operation) {
      skipStats.noFix++;
      continue;
    }

    // Add to plan - all fixes are collected
    // Conflicts are handled by conflict-detector.ts
    // Execution order is handled by parallel-executor.ts (bottom-to-top per file)
    addToPlan(plans, issue, operation, difficulty);
  }

  // Sort fixes within each plan by line number (descending)
  // This ensures fixes are applied bottom-to-top to preserve line numbers
  for (const plan of plans.values()) {
    plan.fixes.sort((a, b) => {
      const lineA = a.operation.line ?? 0;
      const lineB = b.operation.line ?? 0;
      return lineB - lineA;
    });
  }

  return { plans: [...plans.values()], skipStats };
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
  };
}
