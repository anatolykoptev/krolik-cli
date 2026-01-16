/**
 * @module commands/audit/utils
 * @description Shared utilities for audit commands - scoring and formatting functions
 */

export type ReadabilityGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export type ConfidenceLevel = number;

/**
 * Get confidence label for display
 */
export function getConfidenceLabel(confidence: ConfidenceLevel): string {
  if (confidence >= 90) return 'very high';
  if (confidence >= 75) return 'high';
  if (confidence >= 50) return 'medium';
  if (confidence >= 25) return 'low';
  return 'very low';
}

/**
 * Convert numeric score to letter grade
 */
export function scoreToGrade(score: number): ReadabilityGrade {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Format percentile as human-readable rank
 */
export function formatRank(percentile: number): string {
  if (percentile >= 95) return 'top-5%';
  if (percentile >= 90) return 'top-10%';
  if (percentile >= 80) return 'top-20%';
  if (percentile >= 50) return 'top-50%';
  return 'bottom-50%';
}
