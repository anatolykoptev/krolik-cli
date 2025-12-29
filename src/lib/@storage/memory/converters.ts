/**
 * @module lib/@storage/memory/converters
 * @description Database row to object converters
 */

import type { Memory, MemoryImportance, MemoryType } from './types';

/**
 * Convert database row to Memory object
 * @param row - Raw database row
 * @returns Parsed Memory object
 */
export function rowToMemory(row: Record<string, unknown>): Memory {
  return {
    id: String(row.id),
    type: row.type as MemoryType,
    title: row.title as string,
    description: row.description as string,
    importance: row.importance as MemoryImportance,
    project: row.project as string,
    branch: row.branch as string | undefined,
    commit: row.commit_hash as string | undefined,
    tags: JSON.parse((row.tags as string) || '[]'),
    files: JSON.parse((row.files as string) || '[]'),
    features: JSON.parse((row.features as string) || '[]'),
    createdAt: row.created_at as string,
    metadata: JSON.parse((row.metadata as string) || '{}'),
  };
}
