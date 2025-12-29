/**
 * @module commands/context/formatters/ai/constants
 * @description Constants for AI XML formatter output limits
 *
 * Imports shared constants from @output-optimizer where applicable.
 * Local constants are kept for values specific to this formatter.
 */

import { MAX_INLINE_LIST_ITEMS, MAX_MEMORY_ITEMS, MAX_PATH_LENGTH } from '@/lib/@format';

// Re-export optimizer constants for convenience
export { MAX_INLINE_LIST_ITEMS, MAX_MEMORY_ITEMS, MAX_PATH_LENGTH };

// Limit constants for output formatting
export const MAX_LIMIT = 6;
export const MAX_ITEMS_SMALL = 3;
/** Uses MAX_INLINE_LIST_ITEMS from @output-optimizer */
export const MAX_ITEMS_MEDIUM = MAX_INLINE_LIST_ITEMS; // 5
export const MAX_ITEMS_LARGE = 8;
export const MAX_SIZE = 15;
export const DEFAULT_PAGE_SIZE = 20;
