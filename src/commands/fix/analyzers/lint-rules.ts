/**
 * @module commands/quality/analyzers/lint-rules
 * @description Universal lint rules (no-console, no-debugger, max-nesting, etc.)
 *
 * Uses shared patterns from @lib/@patterns/lint
 * Uses shared context from @lib/@context
 */

import type { QualityIssue } from "../types";
import { LINT_RULES, type LintRule } from "../../../lib/@patterns/lint";
import { isCliFile } from "../../../lib/@context";
import { DEFAULT_MAX_NESTING } from "../../../lib/@patterns/complexity";

/**
 * Lint check options
 */
export interface LintOptions {
  maxNestingDepth?: number;
  enabledRules?: string[];
  disabledRules?: string[];
  /** Ignore console in CLI files */
  ignoreCliConsole?: boolean;
}

// Re-export for backward compatibility
export { isCliFile };

// ============================================================================
// NESTING DEPTH DETECTION
// ============================================================================

/**
 * Check for excessive nesting depth
 */
function checkNestingDepth(
  content: string,
  filepath: string,
  maxDepth: number = DEFAULT_MAX_NESTING,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split("\n");
  let currentDepth = 0;
  const reported = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    // Count braces in line
    for (const char of line) {
      if (char === "{") currentDepth++;
      if (char === "}") currentDepth--;
    }

    // Report excessive depth (once per function)
    if (currentDepth > maxDepth && !reported.has(Math.floor(i / 10))) {
      issues.push({
        file: filepath,
        line: i + 1,
        severity: currentDepth > maxDepth + 2 ? "error" : "warning",
        category: "complexity",
        message: `Excessive nesting depth: ${currentDepth} (max: ${maxDepth})`,
        suggestion:
          "Extract nested logic into separate functions or use early returns",
        snippet: line.trim().slice(0, 60),
      });
      reported.add(Math.floor(i / 10));
    }
  }

  return issues;
}

// ============================================================================
// PATTERN-BASED CHECKS
// ============================================================================

/**
 * Check if file should be skipped for a rule
 */
function shouldSkipForRule(filepath: string, rule: LintRule): boolean {
  if (!rule.skipInFiles) return false;
  return rule.skipInFiles.some((pattern) => filepath.includes(pattern));
}

/**
 * Check if pattern is inside a comment
 * Note: Also checks that // or /* is not inside a string
 */
function isInsideComment(line: string, matchIndex: number): boolean {
  const beforeMatch = line.slice(0, matchIndex);

  // Find // or /* but make sure it's not inside a string
  const commentPos = beforeMatch.indexOf("//");
  if (commentPos !== -1 && !isInsideString(line, commentPos)) {
    return true;
  }

  const blockPos = beforeMatch.indexOf("/*");
  if (blockPos !== -1 && !isInsideString(line, blockPos)) {
    return true;
  }

  return false;
}

/**
 * Check if pattern is inside a string or regex literal
 */
function isInsideString(line: string, matchIndex: number): boolean {
  let inString = false;
  let stringChar = "";
  let inRegex = false;
  let escaped = false;

  for (let i = 0; i < matchIndex; i++) {
    const char = line[i];

    // Handle escape sequences
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    // String handling
    if (!inRegex) {
      if (!inString && (char === '"' || char === "'" || char === "`")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = "";
      }
    }

    // Regex handling - only when not in string
    // Regex starts with / when preceded by: = ( , [ ! & | : ; { } or start of line
    if (!inString && !inRegex && char === "/") {
      const prevNonSpace = line.slice(0, i).trimEnd().slice(-1);
      if (
        !prevNonSpace ||
        "=([,!&|:;{}".includes(prevNonSpace) ||
        line.slice(0, i).trimEnd().endsWith("return")
      ) {
        inRegex = true;
      }
    } else if (inRegex && char === "/") {
      inRegex = false;
    }
  }

  return inString || inRegex;
}

/**
 * Run pattern-based lint rules
 */
function checkLintRules(
  content: string,
  filepath: string,
  options: LintOptions = {},
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    // Skip full-line comments
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    for (const rule of LINT_RULES) {
      if (shouldSkipForRule(filepath, rule)) continue;

      // Skip console rules in CLI files when option enabled
      if (rule.skipInCli && options.ignoreCliConsole) {
        continue;
      }

      // Reset regex lastIndex
      rule.pattern.lastIndex = 0;

      let match;
      while ((match = rule.pattern.exec(line)) !== null) {
        // Skip if inside comment or string
        if (isInsideComment(line, match.index)) continue;
        if (isInsideString(line, match.index)) continue;

        issues.push({
          file: filepath,
          line: i + 1,
          severity: rule.severity,
          category: "lint",
          message: rule.message,
          suggestion: rule.suggestion,
          snippet: trimmed.slice(0, 60),
        });
      }
    }
  }

  return issues;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Run all lint checks on content
 */
export function checkLintRules_all(
  content: string,
  filepath: string,
  options: LintOptions = {},
): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Auto-detect CLI files and adjust options
  const effectiveOptions = { ...options };
  if (isCliFile(filepath)) {
    effectiveOptions.ignoreCliConsole = true;
  }

  // Pattern-based rules
  issues.push(...checkLintRules(content, filepath, effectiveOptions));

  // Nesting depth
  const maxDepth = options.maxNestingDepth ?? DEFAULT_MAX_NESTING;
  issues.push(...checkNestingDepth(content, filepath, maxDepth));

  return issues;
}

// Export individual functions for testing
export { checkLintRules, checkNestingDepth };
