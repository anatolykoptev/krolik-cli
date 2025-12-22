/**
 * @module commands/fix/strategies
 * @description All fix strategies
 *
 * Each strategy is organized in its own module:
 * - lint/        - console, debugger, alert fixes
 * - type-safety/ - @ts-ignore, @ts-nocheck, explicit any
 * - complexity/  - nesting, long functions, complexity
 * - srp/         - file splitting for large files
 * - hardcoded/   - magic numbers, URLs extraction
 */

import type { FixStrategy } from '../types';
import { lintStrategy } from './lint';
import { typeSafetyStrategy } from './type-safety';
import { complexityStrategy } from './complexity';
import { srpStrategy } from './srp';
import { hardcodedStrategy } from './hardcoded';

/**
 * All available fix strategies
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
  | { status: 'no-strategy' }       // No strategy handles this category
  | { status: 'context-skipped' };  // Strategy exists but skipped by context

/**
 * Find strategy that can handle an issue
 */
export function findStrategy(
  issue: import('../../quality/types').QualityIssue,
  content: string,
): FixStrategy | null {
  for (const strategy of ALL_STRATEGIES) {
    if (strategy.categories.includes(issue.category) && strategy.canFix(issue, content)) {
      return strategy;
    }
  }
  return null;
}

/**
 * Find strategy with detailed result
 */
export function findStrategyDetailed(
  issue: import('../../quality/types').QualityIssue,
  content: string,
): FindStrategyResult {
  // First check if any strategy handles this category
  const categoryStrategies = ALL_STRATEGIES.filter((s) =>
    s.categories.includes(issue.category),
  );

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

// Re-export individual strategies
export { lintStrategy } from './lint';
export { typeSafetyStrategy } from './type-safety';
export { complexityStrategy } from './complexity';
export { srpStrategy } from './srp';
export { hardcodedStrategy } from './hardcoded';
