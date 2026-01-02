/**
 * @module commands/audit/output/health-score
 * @description Health score calculation for code quality reports
 *
 * Calculates an A-F grade based on issue severity distribution,
 * with optional trend detection from previous audits.
 */

import type { AIReport, PriorityLevel } from '../../fix/reporter/types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Health grade from A (best) to F (worst)
 */
export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

/**
 * Trend direction compared to previous audit
 */
export type HealthTrend = 'improving' | 'stable' | 'declining';

/**
 * Complete health score result
 */
export interface HealthScore {
  /** Letter grade A-F */
  grade: HealthGrade;
  /** Numeric score 0-100 */
  score: number;
  /** Trend compared to previous audit */
  trend: HealthTrend;
  /** Human-readable explanation */
  reason: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Weight multipliers for each priority level
 * Critical issues hurt score more than low issues
 */
const PRIORITY_WEIGHTS: Record<PriorityLevel, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 1,
};

/**
 * Grade thresholds (score >= threshold = grade)
 */
const GRADE_THRESHOLDS: Array<{ threshold: number; grade: HealthGrade }> = [
  { threshold: 90, grade: 'A' },
  { threshold: 75, grade: 'B' },
  { threshold: 60, grade: 'C' },
  { threshold: 40, grade: 'D' },
  { threshold: 0, grade: 'F' },
];

/**
 * Maximum penalty (score starts at 100, min is 0)
 */
const MAX_SCORE = 100;
const MIN_SCORE = 0;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Calculate health score from audit report
 *
 * @param report - The AI report containing issue counts
 * @param previousScore - Optional previous score for trend detection
 * @returns Health score with grade, numeric value, and trend
 *
 * @example
 * const health = calculateHealthScore(report);
 * console.log(`Grade: ${health.grade}, Score: ${health.score}`);
 */
export function calculateHealthScore(report: AIReport, previousScore?: number): HealthScore {
  const { byPriority } = report.summary;

  // Calculate weighted penalty
  const totalPenalty =
    byPriority.critical * PRIORITY_WEIGHTS.critical +
    byPriority.high * PRIORITY_WEIGHTS.high +
    byPriority.medium * PRIORITY_WEIGHTS.medium +
    byPriority.low * PRIORITY_WEIGHTS.low;

  // Score = 100 - penalty (clamped to 0-100)
  const rawScore = MAX_SCORE - totalPenalty;
  const score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, rawScore));

  // Determine grade
  const grade = determineGrade(score);

  // Determine trend
  const trend = determineTrend(score, previousScore);

  // Generate reason
  const reason = generateReason(byPriority, grade);

  return { grade, score, trend, reason };
}

/**
 * Get grade from numeric score
 */
export function determineGrade(score: number): HealthGrade {
  for (const { threshold, grade } of GRADE_THRESHOLDS) {
    if (score >= threshold) {
      return grade;
    }
  }
  return 'F';
}

/**
 * Determine trend based on score comparison
 */
export function determineTrend(currentScore: number, previousScore?: number): HealthTrend {
  if (previousScore === undefined) {
    return 'stable';
  }

  const delta = currentScore - previousScore;

  if (delta >= 5) {
    return 'improving';
  }
  if (delta <= -5) {
    return 'declining';
  }
  return 'stable';
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate human-readable reason for the grade
 */
function generateReason(byPriority: Record<PriorityLevel, number>, grade: HealthGrade): string {
  const parts: string[] = [];

  if (byPriority.critical > 0) {
    parts.push(`${byPriority.critical} critical`);
  }
  if (byPriority.high > 0) {
    parts.push(`${byPriority.high} high`);
  }

  if (parts.length === 0) {
    if (grade === 'A') {
      return 'Excellent code quality with minimal issues';
    }
    return `${byPriority.medium} medium, ${byPriority.low} low priority issues`;
  }

  return `${parts.join(', ')} priority issues need attention`;
}

/**
 * Format health score as compact XML attribute string
 *
 * @example
 * formatHealthScoreAttr(health) // 'score="C" trend="improving"'
 */
export function formatHealthScoreAttr(health: HealthScore): string {
  return `score="${health.grade}" trend="${health.trend}"`;
}
