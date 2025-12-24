/**
 * @module commands/context/formatters/ai/helpers
 * @description Helper utilities for AI XML formatter
 *
 * NOTE: escapeXml and truncate are re-exported from lib/formatters.
 * New code should import directly from '@/lib/@formatters'.
 */

// Re-export constants for convenience
export {
  MAX_LIMIT,
  MAX_ITEMS_SMALL,
  MAX_ITEMS_MEDIUM,
  MAX_ITEMS_LARGE,
  MAX_SIZE,
  DEFAULT_PAGE_SIZE,
} from './constants';

// Re-export from lib/formatters for backwards compatibility
export { escapeXml, truncate } from '@/lib';
