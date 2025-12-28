/**
 * @module lib/@context
 * @deprecated This module has been migrated to lib/@patterns/file-context
 *
 * Please update imports:
 * - OLD: import { isCliFile } from '@/lib/@context'
 * - NEW: import { isCliFile } from '@/lib/@patterns/file-context'
 *
 * This re-export file will be removed in a future version.
 */

// Re-export everything from the new location for backward compatibility
export * from '../@patterns/file-context';
