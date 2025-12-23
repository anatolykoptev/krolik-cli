/**
 * @module commands/quality/analyzers/lint-rules
 * @description Universal lint rules (no-console, no-debugger, max-nesting, etc.)
 */

import type { QualityIssue, QualitySeverity } from "../types";

// ============================================================================
// RULE DEFINITIONS
// ============================================================================

interface LintRule {
  id: string;
  pattern: RegExp;
  message: string;
  suggestion: string;
  severity: QualitySeverity;
  category: "lint";
  /** Skip in certain file types */
  skipInFiles?: string[];
  /** Rule ID for context-aware skipping */
  skipWithOption?: string;
}

const MAX_VALUE = 4;

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

/**
 * CLI file patterns for auto-detection
 */
const CLI_FILE_PATTERNS = [
  // Direct CLI indicators
  /[/\\]bin[/\\]/,
  /[/\\]cli[/\\]/,
  /\.cli\.(ts|js)$/,
  /cli\.(ts|js)$/,
  /bin\.(ts|js)$/,
  // Command handlers often need console output
  /[/\\]commands[/\\].*[/\\]index\.(ts|js)$/,
  // MCP servers communicate via stdout
  /[/\\]mcp[/\\]/,
  // Scripts directory
  /[/\\]scripts[/\\]/,
];

/**
 * Check if file is a CLI entry point or command handler
 */
export function isCliFile(filepath: string): boolean {
  return CLI_FILE_PATTERNS.some((pattern) => pattern.test(filepath));
}

/**
 * Universal lint rules
 */
const LINT_RULES: LintRule[] = [
  {
    id: "no-console",
    pattern: /\bconsole\.(log|info|warn|error|debug|trace)\s*\(/g,
    message: "Unexpected console statement",
    suggestion: "Remove console statement or use a proper logging library",
    severity: "warning",
    category: "lint",
    skipInFiles: [".test.", ".spec.", "logger."],
    skipWithOption: "ignoreCliConsole",
  },
  {
    id: "no-debugger",
    pattern: /\bdebugger\b/g,
    message: "Unexpected debugger statement",
    suggestion: "Remove debugger statement before committing",
    severity: "error",
    category: "lint",
  },
  {
    id: "no-alert",
    pattern: /\b(alert|confirm|prompt)\s*\(/g,
    message: "Unexpected native dialog",
    suggestion: "Use a modal component instead of native browser dialogs",
    severity: "warning",
    category: "lint",
    skipInFiles: [".test.", ".spec."],
  },
  {
    id: "no-eval",
    pattern: /\beval\s*\(/g,
    message: "eval() is a security risk",
    suggestion:
      "Avoid eval() - use safer alternatives like JSON.parse() or Function constructor",
    severity: "error",
    category: "lint",
  },
  {
    id: "no-var",
    pattern: /\bvar\s+\w+/g,
    message: "Unexpected var declaration",
    suggestion: "Use const or let instead of var",
    severity: "info",
    category: "lint",
  },
  {
    id: "no-todo-comments",
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG):/gi,
    message: "Unresolved TODO/FIXME comment",
    suggestion: "Address or create a ticket for this TODO",
    severity: "info",
    category: "lint",
  },
];

// ============================================================================
// NESTING DEPTH DETECTION
// ============================================================================

/**
 * Calculate nesting depth of a line
 */
function calculateNestingDepth(lines: string[], lineIndex: number): number {
  let depth = 0;
  for (let i = 0; i <= lineIndex; i++) {
    const line = lines[i] ?? "";
    for (const char of line) {
      if (char === "{" || char === "(") depth++;
      if (char === "}" || char === ")") depth--;
    }
  }
  return depth;
}

/**
 * Check for excessive nesting depth
 */
function checkNestingDepth(
  content: string,
  filepath: string,
  maxDepth: number = MAX_VALUE,
): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split("\n");
  let currentDepth = 0;
  let reported = new Set<number>();

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
 */
function isInsideComment(line: string, matchIndex: number): boolean {
  const beforeMatch = line.slice(0, matchIndex);
  return beforeMatch.includes("//") || beforeMatch.includes("/*");
}

/**
 * Check if pattern is inside a string literal
 */
function isInsideString(line: string, matchIndex: number): boolean {
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < matchIndex; i++) {
    const char = line[i];
    const prevChar = line[i - 1];

    if (!inString && (char === '"' || char === "'" || char === "`")) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && prevChar !== "\\") {
      inString = false;
    }
  }

  return inString;
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
      if (
        rule.skipWithOption === "ignoreCliConsole" &&
        options.ignoreCliConsole
      ) {
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
          category: "lint" as any, // Will be added to QualityCategory
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
  const maxDepth = options.maxNestingDepth ?? MAX_VALUE;
  issues.push(...checkNestingDepth(content, filepath, maxDepth));

  return issues;
}

// Export individual functions for testing
export { checkLintRules, checkNestingDepth };
