/**
 * @module commands/context/formatters/ai/helpers
 * @description Helper utilities for AI XML formatter
 *
 * NOTE: All formatters and utilities are now consolidated in '@/lib/format'.
 */

// Re-export from lib/format for backwards compatibility
export { abbreviatePath, escapeXml, truncate } from '@/lib/format';

// Re-export constants for convenience (includes optimizer constants)
export {
  DEFAULT_PAGE_SIZE,
  MAX_INLINE_LIST_ITEMS,
  MAX_ITEMS_LARGE,
  MAX_ITEMS_MEDIUM,
  MAX_ITEMS_SMALL,
  MAX_LIMIT,
  MAX_MEMORY_ITEMS,
  MAX_PATH_LENGTH,
  MAX_SIZE,
} from './constants';
