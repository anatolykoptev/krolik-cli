/**
 * @module commands/fix/core/file-backup
 * @description Shared utilities for file backup and restoration operations
 */

import * as fs from 'node:fs';
import type { FileBackup } from '../composite/types';

/**
 * Create backup of a file
 */
export function backupFile(filePath: string): FileBackup {
  const exists = fs.existsSync(filePath);

  return {
    path: filePath,
    content: exists ? fs.readFileSync(filePath, 'utf-8') : null,
    isNew: !exists,
  };
}

/**
 * Restore file from backup
 */
export function restoreFile(backup: FileBackup): void {
  if (backup.isNew) {
    // File was created - delete it
    if (fs.existsSync(backup.path)) {
      fs.unlinkSync(backup.path);
    }
  } else if (backup.content !== null) {
    // File existed - restore content
    fs.writeFileSync(backup.path, backup.content);
  }
}
