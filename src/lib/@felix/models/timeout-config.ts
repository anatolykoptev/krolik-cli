/**
 * Timeout Configuration for LLM Models
 *
 * Complexity-based timeout settings shared across different LLM backends.
 *
 * @module @felix/models/timeout-config
 */

/**
 * Default timeout in milliseconds (10 minutes)
 */
export const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Timeout by task complexity (in milliseconds)
 * Based on expected task duration:
 * - trivial: <30min -> 2 min timeout
 * - simple: <1h -> 5 min timeout
 * - moderate: <3h -> 10 min timeout
 * - complex: <8h -> 20 min timeout
 * - epic: >8h -> 30 min timeout
 */
export const TIMEOUT_BY_COMPLEXITY: Record<string, number> = {
  trivial: 2 * 60 * 1000, // 2 min
  simple: 5 * 60 * 1000, // 5 min
  moderate: 10 * 60 * 1000, // 10 min
  complex: 20 * 60 * 1000, // 20 min
  epic: 30 * 60 * 1000, // 30 min
};

/**
 * Get timeout for task complexity
 * @param complexity - Task complexity level (trivial, simple, moderate, complex, epic)
 * @returns Timeout in milliseconds
 */
export function getTimeoutForComplexity(complexity: string | undefined): number {
  if (!complexity) return DEFAULT_TIMEOUT_MS;
  return TIMEOUT_BY_COMPLEXITY[complexity] ?? DEFAULT_TIMEOUT_MS;
}

/**
 * Format timeout for logging (e.g., "2min", "10min")
 */
export function formatTimeout(ms: number): string {
  const minutes = Math.round(ms / 60000);
  return `${minutes}min`;
}
