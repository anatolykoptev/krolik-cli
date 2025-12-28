/**
 * @deprecated This module has been moved to '@/lib/core/fs'.
 * Please update your imports to use the new location.
 *
 * Migration:
 *   - import { scanDirectory, exists, readFile } from '@/lib/@fs';
 *   + import { scanDirectory, exists, readFile } from '@/lib/core/fs';
 *
 * This re-export will be removed in a future version.
 */
export * from '../core/fs';
