/**
 * @module commands/context/formatters/ai/helpers
 * @description Helper utilities for AI XML formatter
 *
 * NOTE: escapeXml and truncate are re-exported from lib/formatters.
 * New code should import directly from '@/lib/@formatters'.
 */

// Re-export from lib/formatters for backwards compatibility
export { escapeXml, truncate } from '@/lib';
// Re-export constants for convenience
export {
  DEFAULT_PAGE_SIZE,
  MAX_ITEMS_LARGE,
  MAX_ITEMS_MEDIUM,
  MAX_ITEMS_SMALL,
  MAX_LIMIT,
  MAX_SIZE,
} from './constants';
