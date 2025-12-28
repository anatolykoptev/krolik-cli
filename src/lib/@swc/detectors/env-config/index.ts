/**
 * @module lib/@swc/detectors/env-config
 * @deprecated Use '@/lib/@patterns/env-config' instead.
 * This module re-exports from the canonical location for backward compatibility.
 *
 * Migration:
 * ```ts
 * // Before
 * import { detectEnvConfigIssue } from '@/lib/@swc/detectors/env-config';
 *
 * // After
 * import { detectEnvConfigIssue } from '@/lib/@patterns/env-config';
 * ```
 */

// Re-export everything from canonical location
export * from '@/lib/@patterns/env-config';
