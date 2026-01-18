/**
 * JSON Formatter for PRD output
 *
 * @module commands/prd/formatters/json
 */

import type { PRD, PrdGenerationResult } from '../types';

/**
 * Format PRD as JSON string
 */
export function formatPrdJson(prd: PRD): string {
  return JSON.stringify(prd, null, 2);
}

/**
 * Format generation result as JSON
 */
export function formatResultJson(result: PrdGenerationResult): string {
  if (!result.success) {
    return JSON.stringify(
      {
        success: false,
        errors: result.errors,
        meta: result.meta,
      },
      null,
      2,
    );
  }

  if (result.prd) {
    return formatPrdJson(result.prd);
  }

  return result.json ?? JSON.stringify({ error: 'No PRD generated' }, null, 2);
}
