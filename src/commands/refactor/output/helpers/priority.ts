/**
 * @module commands/refactor/output/helpers/priority
 * @description Priority calculation and sorting utilities for XML output
 */

/** Severity levels with numeric weights for sorting */
export const SEVERITY_WEIGHTS = {
  critical: 1,
  high: 2,
  error: 2,
  medium: 3,
  warning: 3,
  low: 4,
  info: 5,
} as const;

export type SeverityLevel = keyof typeof SEVERITY_WEIGHTS;

/**
 * Get numeric weight for severity level
 * Lower weight = higher priority
 */
export function getSeverityWeight(severity: string): number {
  return SEVERITY_WEIGHTS[severity as SeverityLevel] ?? 99;
}

/**
 * Sort items by severity (most severe first)
 */
export function sortBySeverity<T extends { severity: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => getSeverityWeight(a.severity) - getSeverityWeight(b.severity));
}

/**
 * Sort items by similarity percentage (highest first)
 */
export function sortBySimilarity<T extends { similarity: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.similarity - a.similarity);
}

/**
 * Sort items by score (highest first)
 */
export function sortByScore<T extends { score: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => b.score - a.score);
}

/**
 * Sort items by order field (ascending)
 */
export function sortByOrder<T extends { order: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order);
}

/**
 * Sort items by priority field (ascending - lower priority number = more important)
 */
export function sortByPriority<T extends { priority: number | string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aPriority = typeof a.priority === 'string' ? parseInt(a.priority, 10) : a.priority;
    const bPriority = typeof b.priority === 'string' ? parseInt(b.priority, 10) : b.priority;
    return aPriority - bPriority;
  });
}

/**
 * Calculate priority based on multiple factors
 */
export interface PriorityFactors {
  severity?: string;
  similarity?: number;
  affectedFiles?: number;
  autoFixable?: boolean;
  risk?: string;
}

export function calculatePriority(factors: PriorityFactors): number {
  let priority = 50; // Base priority

  // Severity adjustment
  if (factors.severity) {
    priority -= (5 - getSeverityWeight(factors.severity)) * 10;
  }

  // Similarity adjustment (higher similarity = higher priority)
  if (factors.similarity !== undefined) {
    priority -= factors.similarity * 20;
  }

  // Affected files adjustment (more files = higher priority)
  if (factors.affectedFiles !== undefined) {
    priority -= Math.min(factors.affectedFiles, 10) * 2;
  }

  // Auto-fixable = slightly higher priority
  if (factors.autoFixable) {
    priority -= 5;
  }

  // Risk adjustment
  if (factors.risk === 'safe') {
    priority -= 10;
  } else if (factors.risk === 'risky') {
    priority += 10;
  }

  return Math.max(1, Math.min(100, Math.round(priority)));
}
