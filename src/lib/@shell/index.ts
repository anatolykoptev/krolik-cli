/**
 * @deprecated This module has been moved to '@/lib/core/shell'.
 * Please update your imports to use the new location.
 *
 * Migration:
 *   - import { exec, tryExec, execLines, commandExists } from '@/lib/@shell';
 *   + import { exec, tryExec, execLines, commandExists } from '@/lib/core/shell';
 *
 * This re-export will be removed in a future version.
 */
export * from '../core/shell';
