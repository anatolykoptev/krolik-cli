/**
 * @module commands/fix/strategies
 * @description All fix strategies
 *
 * @deprecated Use fixers from './fixers' instead. Will be removed in v1.0
 *
 * This module is part of the legacy fix architecture. After the Phase 3 refactoring
 * (see docs/implementation/FIX-REFACTORING-PLAN.md), all fixing logic has been
 * consolidated into the fixer-based architecture in './fixers'.
 *
 * Migration guide:
 * - Instead of `findStrategy(issue, content)`, use `registry.get(issue.fixerId)`
 * - Instead of `strategy.generateFix()`, use `fixer.fix()`
 * - Strategies are no longer called from plan.ts
 *
 * Each strategy is organized in its own module:
 * - lint/        - console, debugger, alert fixes
 * - type-safety/ - @ts-expect-error, @ts-nocheck, explicit any
 * - complexity/  - nesting, long functions, complexity
 * - srp/         - file splitting for large files
 * - hardcoded/   - magic numbers, URLs extraction
 */

import type { FixStrategy, QualityIssue } from '../types';
import { complexityStrategy } from './complexity';
import { hardcodedStrategy } from './hardcoded';
import { lintStrategy } from './lint';
import { srpStrategy } from './srp';
import { typeSafetyStrategy } from './type-safety';

/**
 * All available fix strategies
 * @deprecated Use fixers from './fixers' instead. Will be removed in v1.0
 */
export const ALL_STRATEGIES: FixStrategy[] = [
  lintStrategy,
  typeSafetyStrategy,
  complexityStrategy,
  srpStrategy,
  hardcodedStrategy,
];

/**
 * Result of finding a strategy
 */
export type FindStrategyResult =
  | { status: 'found'; strategy: FixStrategy }
  | { status: 'no-strategy' } // No strategy handles this category
  | { status: 'context-skipped' }; // Strategy exists but skipped by context

/**
 * Find strategy that can handle an issue
 * @deprecated Use `registry.get(issue.fixerId)` from './fixers' instead. Will be removed in v1.0
 */
export function findStrategy(issue: QualityIssue, content: string): FixStrategy | null {
  for (const strategy of ALL_STRATEGIES) {
    if (strategy.categories.includes(issue.category) && strategy.canFix(issue, content)) {
      return strategy;
    }
  }
  return null;
}

/**
 * Find strategy with detailed result
 * @deprecated Use `registry.get(issue.fixerId)` from './fixers' instead. Will be removed in v1.0
 */
export function findStrategyDetailed(issue: QualityIssue, content: string): FindStrategyResult {
  // First check if any strategy handles this category
  const categoryStrategies = ALL_STRATEGIES.filter((s) => s.categories.includes(issue.category));

  if (categoryStrategies.length === 0) {
    return { status: 'no-strategy' };
  }

  // Check if any strategy can fix this issue
  for (const strategy of categoryStrategies) {
    if (strategy.canFix(issue, content)) {
      return { status: 'found', strategy };
    }
  }

  // Strategy exists but declined to fix (context-aware skip)
  return { status: 'context-skipped' };
}

export { complexityStrategy } from './complexity';
export { hardcodedStrategy } from './hardcoded';
// Re-export individual strategies
export { lintStrategy } from './lint';
export { srpStrategy } from './srp';
export { typeSafetyStrategy } from './type-safety';
