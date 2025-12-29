/**
 * @module lib/@core/time
 * @description Time measurement utilities
 * @ai-context Use for performance tracking and profiling
 */

/**
 * Measure synchronous function execution time
 */
export function measureTime<T>(fn: () => T): { result: T; durationMs: number } {
  const start = performance.now();
  const result = fn();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs };
}

/**
 * Measure async function execution time
 */
export async function measureTimeAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; durationMs: number }> {
  const start = performance.now();
  const result = await fn();
  const durationMs = Math.round(performance.now() - start);
  return { result, durationMs };
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
