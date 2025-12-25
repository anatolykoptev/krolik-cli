/**
 * @module types/severity
 * @description Shared severity type used across commands
 *
 * This type is extracted to break circular dependencies between:
 * - types/commands/review.ts
 * - commands/fix/types.ts
 */

/**
 * Shared severity type used across commands
 */
export type Severity = 'error' | 'warning' | 'info';
