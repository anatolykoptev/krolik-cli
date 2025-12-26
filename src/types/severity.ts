/**
 * @module types/severity
 * @description Shared severity and priority types used across commands
 *
 * These types are extracted to break circular dependencies and ensure consistency.
 */

/**
 * Shared severity type (3-level) for issues, warnings, info
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Shared priority type (4-level) for task prioritization
 */
export type Priority = 'critical' | 'high' | 'medium' | 'low';
