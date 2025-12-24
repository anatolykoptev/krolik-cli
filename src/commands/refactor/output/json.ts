/**
 * @module commands/refactor/output/json
 * @description JSON output formatter
 */

import type { RefactorAnalysis } from '../core';

// ============================================================================
// MAIN FORMATTER
// ============================================================================

/**
 * Format refactor analysis as JSON
 */
export function formatRefactorJson(analysis: RefactorAnalysis): string {
  return JSON.stringify(analysis, null, 2);
}

/**
 * Format refactor analysis as compact JSON
 */
export function formatRefactorJsonCompact(analysis: RefactorAnalysis): string {
  return JSON.stringify(analysis);
}
