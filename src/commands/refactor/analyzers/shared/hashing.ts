/**
 * @module commands/refactor/analyzers/shared/hashing
 * @description Shared hashing utilities for duplicate detection
 */

import { createHash } from 'node:crypto';

/**
 * Hash content using MD5 for fast comparison
 * Used for both function bodies and type structures
 *
 * @param content - Content to hash
 * @returns MD5 hash as hex string
 */
export function hashContent(content: string): string {
  return createHash('md5').update(content).digest('hex');
}
