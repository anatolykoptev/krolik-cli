/**
 * @module lib/@formatters
 * @deprecated Use '@/lib/format' instead. This module will be removed in a future version.
 * @description Centralized formatting utilities (deprecated re-export)
 *
 * This module is kept for backward compatibility.
 * All exports are re-exported from '@/lib/format'.
 *
 * @example
 * // Old (deprecated):
 * import { escapeXml, formatJson, heading, truncate } from '@/lib/@formatters';
 *
 * // New (recommended):
 * import { escapeXml, formatJson, heading, truncate } from '@/lib/format';
 */

// Re-export everything from the new format module
export * from '../format';
