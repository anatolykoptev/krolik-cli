/**
 * @module commands/fix/reporter/action-plan
 * @description Action plan generation for audit reports
 */

import * as fs from 'node:fs';
import type { ActionStep, EnrichedIssue, PriorityLevel } from './types';

// ============================================================================
// EXTENDED SNIPPETS
// ============================================================================

/**
 * Extract extended code snippet with context lines
 * Shows ±contextLines around the issue line with line numbers
 */
export function extractExtendedSnippet(
  filePath: string,
  line: number,
  fileContents: Map<string, string> | undefined,
  contextLines = 5,
): string | undefined {
  if (!line) return undefined;

  try {
    let content = fileContents?.get(filePath);

    if (!content && fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
    }

    if (!content) return undefined;

    const lines = content.split('\n');
    const start = Math.max(0, line - contextLines - 1);
    const end = Math.min(lines.length, line + contextLines);

    return lines
      .slice(start, end)
      .map((l, i) => {
        const num = start + i + 1;
        const marker = num === line ? '→' : ' ';
        return `${marker} ${String(num).padStart(3, ' ')}: ${l}`;
      })
      .join('\n');
  } catch {
    return undefined;
  }
}

// ============================================================================
// ACTION PLAN GENERATION
// ============================================================================

const PRIORITY_ORDER: Record<PriorityLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/**
 * Generate action steps from enriched issues
 * For CRITICAL issues: includes extended snippets (±5 lines)
 * For other issues: uses original snippet (1 line)
 */
export function generateActionPlan(
  enrichedIssues: EnrichedIssue[],
  fileContents?: Map<string, string>,
  maxSteps = 20,
): ActionStep[] {
  const sorted = [...enrichedIssues].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.effort.minutes - b.effort.minutes;
  });

  const steps: ActionStep[] = [];
  let stepId = 1;

  for (const enriched of sorted.slice(0, maxSteps)) {
    const { issue, effort, autoFixable, fixSuggestion } = enriched;

    const action: ActionStep['action'] = autoFixable
      ? 'fix'
      : issue.category === 'complexity' || issue.category === 'srp'
        ? 'refactor'
        : 'review';

    const step: ActionStep = {
      id: `step-${stepId++}`,
      action,
      file: issue.file,
      line: issue.line,
      description: issue.message,
      effort,
      priority: enriched.priority,
      category: issue.category,
    };

    // Add code snippet based on priority
    if (enriched.priority === 'critical' && issue.line) {
      const extendedSnippet = extractExtendedSnippet(issue.file, issue.line, fileContents, 5);
      if (extendedSnippet) {
        step.snippet = extendedSnippet;
      } else if (issue.snippet) {
        step.snippet = issue.snippet;
      }
    } else if (issue.snippet) {
      step.snippet = issue.snippet;
    }

    // Add code context (snippet + complexity breakdown) for CRITICAL/HIGH issues
    if (enriched.codeContext) {
      step.codeContext = enriched.codeContext;
    }

    // Use full suggestion if available (includes typeContext for type-safety issues)
    if (enriched.suggestion) {
      step.suggestion = {
        before: enriched.suggestion.before,
        after: enriched.suggestion.after,
        reason: enriched.suggestion.reasoning,
        typeContext: enriched.suggestion.typeContext,
      };
    } else if (fixSuggestion) {
      step.suggestion = {
        after: fixSuggestion,
        reason: `Fix ${issue.category} issue`,
      };
    }

    steps.push(step);
  }

  return steps;
}
