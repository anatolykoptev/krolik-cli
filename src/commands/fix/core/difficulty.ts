/**
 * @module commands/fix/core/difficulty
 * @description Fix difficulty calculation logic
 */

import type { FixDifficulty, QualityIssue } from './types';

/**
 * Categorize fix difficulty based on issue
 *
 * Difficulty levels:
 * - trivial: Can always safely fix (console.log, debugger)
 * - safe: Unlikely to break anything (@ts-expect-error removal)
 * - risky: May require manual review (refactoring, type changes)
 */
export function getFixDifficulty(issue: QualityIssue): FixDifficulty {
  const { category, message } = issue;
  const msg = message.toLowerCase();

  // Trivial: can always safely fix
  if (category === 'lint') {
    if (msg.includes('console') || msg.includes('debugger') || msg.includes('alert')) {
      return 'trivial';
    }
  }

  // Safe: unlikely to break anything
  if (category === 'type-safety') {
    if (msg.includes('@ts-ignore') || msg.includes('@ts-nocheck')) {
      return 'safe';
    }
  }

  // Magic numbers are safe to extract
  if (category === 'hardcoded') {
    if (msg.includes('number') || msg.includes('magic')) {
      return 'safe';
    }
  }

  // Everything else is risky (refactoring, splitting, etc.)
  return 'risky';
}

/**
 * Check if issue is trivial (safe to auto-fix)
 */
export function isTrivialFix(issue: QualityIssue): boolean {
  return getFixDifficulty(issue) === 'trivial';
}

/**
 * Check if issue is safe to fix
 */
export function isSafeFix(issue: QualityIssue): boolean {
  const difficulty = getFixDifficulty(issue);
  return difficulty === 'trivial' || difficulty === 'safe';
}

/**
 * Filter issues by difficulty
 */
export function filterByDifficulty(
  issues: QualityIssue[],
  maxDifficulty: FixDifficulty,
): QualityIssue[] {
  const allowedLevels: FixDifficulty[] = ['trivial'];

  if (maxDifficulty === 'safe') {
    allowedLevels.push('safe');
  } else if (maxDifficulty === 'risky') {
    allowedLevels.push('safe', 'risky');
  }

  return issues.filter((issue) => allowedLevels.includes(getFixDifficulty(issue)));
}

/**
 * Sort issues by difficulty (trivial first, risky last)
 */
export function sortByDifficulty(issues: QualityIssue[]): QualityIssue[] {
  const order: Record<FixDifficulty, number> = {
    trivial: 0,
    safe: 1,
    risky: 2,
  };

  return [...issues].sort((a, b) => {
    const diffA = getFixDifficulty(a);
    const diffB = getFixDifficulty(b);
    return order[diffA] - order[diffB];
  });
}
