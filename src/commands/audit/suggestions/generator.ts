/**
 * @module commands/audit/suggestions/generator
 * @description Main suggestion generator for audit issues
 *
 * Generates context-aware code suggestions with before/after diffs.
 * Uses SWC for fast AST parsing and type inference.
 *
 * @example
 * ```typescript
 * import { generateSuggestion } from './generator';
 *
 * const suggestion = generateSuggestion(issue, content, filePath);
 * if (suggestion) {
 *   console.log(suggestion.before);  // Original code
 *   console.log(suggestion.after);   // Fixed code
 *   console.log(suggestion.confidence); // 0-100
 * }
 * ```
 */

import * as fs from 'node:fs';
import type { QualityIssue } from '../../fix/core';
import { generateComplexitySuggestion } from './complexity-suggestions';
import { generateLintSuggestion } from './lint-suggestions';
import { generateTypeSafetySuggestion } from './type-safety-suggestions';
import type { Suggestion, SuggestionContext } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Number of context lines to include before/after the issue line
 */
const CONTEXT_LINES = 3;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate a suggestion for a quality issue
 *
 * Analyzes the issue and generates a context-aware suggestion
 * with before/after code and reasoning.
 *
 * @param issue - The quality issue to generate a suggestion for
 * @param content - Optional file content (will be read if not provided)
 * @param filePath - Optional file path (defaults to issue.file)
 * @returns Suggestion with before/after code, or null if no suggestion
 *
 * @example
 * ```typescript
 * const issue: QualityIssue = {
 *   file: 'src/api.ts',
 *   line: 7,
 *   category: 'type-safety',
 *   message: 'Using `any` type',
 *   severity: 'warning',
 * };
 *
 * const suggestion = generateSuggestion(issue);
 * // {
 * //   before: 'const handler: any = (req) => ...',
 * //   after: 'const handler: unknown = (req) => ...',
 * //   reasoning: 'Safe replacement: unknown requires type guards',
 * //   confidence: 100,
 * // }
 * ```
 */
export function generateSuggestion(
  issue: QualityIssue,
  content?: string,
  filePath?: string,
): Suggestion | null {
  const path = filePath ?? issue.file;

  // Read content if not provided
  let fileContent = content;
  if (!fileContent) {
    try {
      fileContent = fs.readFileSync(path, 'utf-8');
    } catch {
      return null;
    }
  }

  // Build suggestion context
  const context = buildSuggestionContext(issue, fileContent, path);
  if (!context) {
    return null;
  }

  // Generate suggestion based on category
  switch (issue.category) {
    case 'type-safety':
      return generateTypeSafetySuggestion(context);

    case 'lint':
      return generateLintSuggestion(context);

    case 'complexity':
      return generateComplexitySuggestion(context);

    default:
      return null;
  }
}

/**
 * Generate suggestions for multiple issues
 *
 * @param issues - Array of quality issues
 * @param contentCache - Optional cache of file contents
 * @returns Map of issue file:line to suggestion
 */
export function generateSuggestions(
  issues: QualityIssue[],
  contentCache?: Map<string, string>,
): Map<string, Suggestion> {
  const suggestions = new Map<string, Suggestion>();
  const fileContents = contentCache ?? new Map<string, string>();

  for (const issue of issues) {
    // Get or read file content
    let content = fileContents.get(issue.file);
    if (!content) {
      try {
        content = fs.readFileSync(issue.file, 'utf-8');
        fileContents.set(issue.file, content);
      } catch {
        continue;
      }
    }

    const suggestion = generateSuggestion(issue, content, issue.file);
    if (suggestion) {
      const key = `${issue.file}:${issue.line ?? 0}`;
      suggestions.set(key, suggestion);
    }
  }

  return suggestions;
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build suggestion context from issue and content
 */
function buildSuggestionContext(
  issue: QualityIssue,
  content: string,
  filePath: string,
): SuggestionContext | null {
  const lines = content.split('\n');
  const targetLine = issue.line ?? 1;

  if (targetLine < 1 || targetLine > lines.length) {
    return null;
  }

  const lineIndex = targetLine - 1;
  const lineContent = lines[lineIndex];

  // lineContent could be undefined if lineIndex is out of range
  if (lineContent === undefined) {
    return null;
  }

  // Extract context lines
  const startBefore = Math.max(0, lineIndex - CONTEXT_LINES);
  const endAfter = Math.min(lines.length - 1, lineIndex + CONTEXT_LINES);

  const linesBefore = lines.slice(startBefore, lineIndex);
  const linesAfter = lines.slice(lineIndex + 1, endAfter + 1);

  return {
    issue,
    content,
    filePath,
    lineContent,
    linesBefore,
    linesAfter,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if a suggestion is high confidence (>= 75%)
 */
export function isHighConfidence(suggestion: Suggestion): boolean {
  return suggestion.confidence >= 75;
}

/**
 * Check if a suggestion is auto-applicable (>= 90%)
 */
export function isAutoApplicable(suggestion: Suggestion): boolean {
  return suggestion.confidence >= 90;
}

/**
 * Format confidence as percentage string
 */
export function formatConfidence(confidence: number): string {
  return `${confidence}%`;
}
