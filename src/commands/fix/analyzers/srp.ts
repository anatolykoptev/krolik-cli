/**
 * @module commands/quality/analyzers/srp
 * @description Single Responsibility Principle and size violation checks
 */

import type { FileAnalysis, QualityIssue, Thresholds } from "../types";

const MAGIC_15 = 15;

const MAX_LENGTH = 3;

/**
 * Check for SRP violations (too many functions, exports, large functions, complexity)
 */
export function checkSRP(
  analysis: FileAnalysis,
  thresholds: Thresholds,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const { functions, exports, lines, path: filepath } = analysis;

  // Too many functions in one file
  if (functions.length > thresholds.maxFunctionsPerFile) {
    const exportedFns = functions.filter((f) => f.isExported);
    issues.push({
      file: filepath,
      severity: "warning",
      category: "srp",
      message: `File has ${functions.length} functions (max: ${thresholds.maxFunctionsPerFile})`,
      suggestion:
        exportedFns.length > MAX_LENGTH
          ? `Split into ${Math.ceil(exportedFns.length / MAX_LENGTH)} files by related functionality`
          : "Consider extracting helper functions to separate utils",
    });
  }

  // Too many exports
  if (exports > thresholds.maxExportsPerFile) {
    issues.push({
      file: filepath,
      severity: "warning",
      category: "srp",
      message: `File exports ${exports} items (max: ${thresholds.maxExportsPerFile})`,
      suggestion:
        "Group related exports into separate modules with index.ts re-exports",
    });
  }

  // File too large
  if (lines > thresholds.maxFileLines) {
    issues.push({
      file: filepath,
      severity: "warning",
      category: "size",
      message: `File has ${lines} lines (max: ${thresholds.maxFileLines})`,
      suggestion: "Split into smaller, focused modules",
    });
  }

  // Large functions and complexity
  for (const fn of functions) {
    if (fn.lines > thresholds.maxFunctionLines) {
      issues.push({
        file: filepath,
        line: fn.startLine,
        severity: "warning",
        category: "complexity",
        message: `Function "${fn.name}" has ${fn.lines} lines (max: ${thresholds.maxFunctionLines})`,
        suggestion: "Extract sub-functions or use early returns",
      });
    }

    // Too many parameters
    if (fn.params > thresholds.maxParams) {
      issues.push({
        file: filepath,
        line: fn.startLine,
        severity: "info",
        category: "complexity",
        message: `Function "${fn.name}" has ${fn.params} parameters (max: ${thresholds.maxParams})`,
        suggestion: "Use options object pattern: fn(options: FnOptions)",
      });
    }

    // High cyclomatic complexity
    if (fn.complexity > thresholds.maxComplexity) {
      issues.push({
        file: filepath,
        line: fn.startLine,
        severity:
          fn.complexity > thresholds.maxComplexity * 2 ? "error" : "warning",
        category: "complexity",
        message: `Function "${fn.name}" has complexity ${fn.complexity} (max: ${thresholds.maxComplexity})`,
        suggestion:
          fn.complexity > MAGIC_15
            ? "Refactor into smaller functions, use strategy pattern, or extract conditions"
            : "Reduce branching by using early returns or extracting helper functions",
      });
    }
  }

  return issues;
}
