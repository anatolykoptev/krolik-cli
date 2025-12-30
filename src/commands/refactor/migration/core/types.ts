/**
 * @module commands/refactor/migration/core/types
 * @description Migration execution types
 *
 * Extracted from orchestrator to prevent circular dependencies.
 * Handlers import these types directly instead of from orchestrator.
 */

import type { MigrationOptions } from '../../core/options';

// ============================================================================
// TYPE ALIASES
// ============================================================================

/**
 * Type alias for backwards compatibility (exported for public API)
 */
export type MigrationExecutionOptions = MigrationOptions;

// ============================================================================
// RESULT TYPES
// ============================================================================

/**
 * Result of executing a single migration action
 */
export interface ExecutionResult {
  success: boolean;
  message: string;
}

/**
 * Result of executing a full migration plan
 */
export interface MigrationExecutionResult {
  success: boolean;
  results: string[];
}
