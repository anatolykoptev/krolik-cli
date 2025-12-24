/**
 * @module commands/status/checks
 * @description Git, typecheck, and lint checking functions
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { StatusResult } from "../../types";
import {
  getCurrentBranch,
  getStatus as getGitStatus,
  getAheadBehind,
  tryExec,
} from "../../lib";

/**
 * Git check result
 */
export interface GitCheck {
  branch: string;
  hasChanges: boolean;
  modified: number;
  untracked: number;
  staged: number;
  ahead: number;
  behind: number;
}

/**
 * Typecheck result
 */
export interface TypecheckResult {
  status: "passed" | "failed" | "skipped";
  cached: boolean;
  errors?: string;
}

/**
 * Lint result
 */
export interface LintResult {
  warnings: number;
  errors: number;
  status: "passed" | "failed" | "skipped";
}

const MAX_PAGE_SIZE = 50;

const MAGIC_5_VALUE = 5;

const MAGIC_5 = MAGIC_5_VALUE;

/**
 * Check git status
 */
export function checkGit(cwd: string): GitCheck {
  const branch = getCurrentBranch(cwd) ?? "unknown";
  const gitStatus = getGitStatus(cwd);
  const aheadBehind = getAheadBehind(cwd);

  return {
    branch,
    hasChanges: gitStatus.hasChanges,
    modified: gitStatus.modified.length,
    untracked: gitStatus.untracked.length,
    staged: gitStatus.staged.length,
    ahead: aheadBehind?.ahead ?? 0,
    behind: aheadBehind?.behind ?? 0,
  };
}

/**
 * Check typecheck status
 */
export function checkTypecheck(cwd: string, skip = false): TypecheckResult {
  if (skip) {
    return { status: "skipped", cached: false };
  }

  // Try to use cached result if available
  const cacheResult = tryExec(
    "test -f .krolik/typecheck-cache.json && cat .krolik/typecheck-cache.json",
    {
      cwd,
      silent: true,
    },
  );

  if (cacheResult.success && cacheResult.output) {
    try {
      const cache = JSON.parse(cacheResult.output);
      const age = Date.now() - cache.timestamp;
      // Use cache if less than 5 minutes old
      if (age < MAGIC_5 * 60 * 1000) {
        return {
          status: cache.passed ? "passed" : "failed",
          cached: true,
        };
      }
    } catch {
      // Ignore cache errors
    }
  }

  const result = tryExec("pnpm typecheck", { cwd, timeout: 60000 });
  const passed = result.success;

  // Save to cache for future fast lookups
  try {
    const cacheDir = path.join(cwd, ".krolik");
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(cacheDir, "typecheck-cache.json"),
      JSON.stringify({ passed, timestamp: Date.now() }),
    );
  } catch {
    // Ignore cache write errors
  }

  return {
    status: passed ? "passed" : "failed",
    cached: false,
    ...(passed || !result.error ? {} : { errors: result.error }),
  };
}

/**
 * Check lint status
 */
export function checkLint(cwd: string, skip = false): LintResult {
  if (skip) {
    return { warnings: 0, errors: 0, status: "skipped" };
  }

  const result = tryExec("pnpm lint 2>&1", { cwd, timeout: 60000 });
  const output = result.output || "";

  const warnings = Number.parseInt(
    output.match(/(\d+)\s*warnings?/i)?.[1] ?? "0",
    10,
  );
  const errors = Number.parseInt(
    output.match(/(\d+)\s*errors?/i)?.[1] ?? "0",
    10,
  );

  return {
    warnings,
    errors,
    status: errors > 0 ? "failed" : "passed",
  };
}

/**
 * Convert checks to StatusResult format
 */
export function toStatusResult(
  git: GitCheck,
  typecheck: TypecheckResult,
  lint: LintResult,
  todos: { count: number },
  durationMs: number,
  expectedBranch?: string,
): StatusResult {
  // Determine health
  let health: StatusResult["health"] = "good";
  if (typecheck.status === "failed" || lint.errors > 0) {
    health = "error";
  } else if (
    lint.warnings > 10 ||
    todos.count > MAX_PAGE_SIZE ||
    git.behind > 0
  ) {
    health = "warning";
  }

  return {
    health,
    branch: {
      name: git.branch,
      isCorrect: expectedBranch ? git.branch === expectedBranch : true,
    },
    git: {
      hasChanges: git.hasChanges,
      modified: git.modified,
      untracked: git.untracked,
      staged: git.staged,
    },
    typecheck: {
      status: typecheck.status,
      cached: typecheck.cached,
      ...(typecheck.errors ? { errors: typecheck.errors } : {}),
    },
    lint: {
      warnings: lint.warnings,
      errors: lint.errors,
    },
    todos,
    durationMs,
  };
}
