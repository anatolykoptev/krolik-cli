/**
 * @module commands/fix/reporter/rules
 * @description Next action and do-not rules for audit reports
 */

import type { AIRuleFile, NextActionItem, ReportSummary } from './types';

// ============================================================================
// NEXT ACTION
// ============================================================================

/**
 * Determine next action based on issues
 */
export function determineNextAction(summary: ReportSummary, aiRules: AIRuleFile[]): NextActionItem {
  // 1. If there are AI rules, read them first
  if (aiRules.length > 0) {
    return {
      priority: 'critical',
      action: `Read AI rules files: ${aiRules.map((r) => r.path).join(', ')}`,
      reason: 'Project has AI configuration files that define conventions and rules',
    };
  }

  // 2. Critical issues
  if (summary.byPriority.critical > 0) {
    return {
      priority: 'critical',
      action: `Fix ${summary.byPriority.critical} critical issue(s) immediately`,
      reason: 'Critical issues may cause runtime errors or security vulnerabilities',
    };
  }

  // 3. High priority issues
  if (summary.byPriority.high > 0) {
    return {
      priority: 'high',
      action: `Address ${summary.byPriority.high} high-priority issue(s)`,
      reason: 'High priority issues indicate architectural problems',
    };
  }

  // 4. Quick wins
  if (summary.autoFixableIssues > 0) {
    return {
      priority: 'medium',
      action: `Auto-fix ${summary.autoFixableIssues} trivial issue(s)`,
      reason: 'Quick wins can be fixed automatically in seconds',
    };
  }

  // 5. Manual issues
  if (summary.totalIssues > 0) {
    return {
      priority: 'low',
      action: `Review ${summary.totalIssues} issue(s) for improvements`,
      reason: 'Code quality can be improved with these fixes',
    };
  }

  return {
    priority: 'low',
    action: 'Code looks good! Ready for development',
    reason: 'No significant issues found',
  };
}

// ============================================================================
// DO-NOT RULES
// ============================================================================

const BASE_RULES = [
  'Do not commit without running typecheck first',
  'Do not push directly to main/master branch',
  'Do not ignore TypeScript errors with @ts-ignore',
];

const CATEGORY_RULES: Record<string, string> = {
  'type-safety': 'Do not use `any` type — use proper type definitions',
  hardcoded: 'Do not use magic numbers — extract to named constants',
  complexity: 'Do not write functions longer than 50 lines — extract helper functions',
  srp: 'Do not export more than 5 items per file — split into modules',
  lint: 'Do not leave console.log in production code',
};

/**
 * Generate do-not rules based on issues found
 */
export function generateDoNotRules(summary: ReportSummary): string[] {
  const rules = [...BASE_RULES];

  for (const [category, rule] of Object.entries(CATEGORY_RULES)) {
    if (summary.byCategory[category] && summary.byCategory[category] > 0) {
      rules.push(rule);
    }
  }

  return rules;
}
