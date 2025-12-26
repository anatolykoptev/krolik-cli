/**
 * @module lib/@memory/storage/crud
 * @description CRUD operations for memories (save, getById, remove, update)
 */

import { getDatabase } from '../database';
import type { Memory, MemoryContext, MemorySaveOptions } from '../types';
import { DEFAULT_IMPORTANCE } from './constants';
import { rowToMemory } from './converters';

/**
 * Save memory to database
 * @param options - Memory content options
 * @param context - Project context (project, branch, commit)
 * @returns Created Memory object
 */
export function save(options: MemorySaveOptions, context: MemoryContext): Memory {
  const db = getDatabase();
  const now = new Date();

  const stmt = db.prepare(`
    INSERT INTO memories (
      type, title, description, importance, project, branch, commit_hash,
      tags, files, features, metadata, created_at, created_at_epoch
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    options.type,
    options.title,
    options.description,
    options.importance ?? DEFAULT_IMPORTANCE,
    context.project,
    context.branch ?? null,
    context.commit ?? null,
    JSON.stringify(options.tags ?? []),
    JSON.stringify(options.files ?? []),
    JSON.stringify(options.features ?? []),
    JSON.stringify(options.metadata ?? {}),
    now.toISOString(),
    now.getTime(),
  );

  return {
    id: String(result.lastInsertRowid),
    type: options.type,
    title: options.title,
    description: options.description,
    importance: options.importance ?? DEFAULT_IMPORTANCE,
    project: context.project,
    branch: context.branch,
    commit: context.commit,
    tags: options.tags ?? [],
    files: options.files,
    features: options.features,
    createdAt: now.toISOString(),
    metadata: options.metadata,
  };
}

/**
 * Get memory by ID
 * @param id - Memory ID
 * @returns Memory object or null if not found
 */
export function getById(id: string): Memory | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM memories WHERE id = ?').get(Number(id)) as
    | Record<string, unknown>
    | undefined;

  if (!row) return null;
  return rowToMemory(row);
}

/**
 * Delete memory by ID
 * @param id - Memory ID
 * @returns true if deleted, false if not found
 */
export function remove(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM memories WHERE id = ?').run(Number(id));
  return result.changes > 0;
}

/**
 * Update memory
 * @param id - Memory ID
 * @param updates - Partial memory fields to update
 * @returns Updated Memory object or null if not found
 */
export function update(
  id: string,
  updates: Partial<Omit<Memory, 'id' | 'createdAt'>>,
): Memory | null {
  const db = getDatabase();

  // Single query to check existence and get current data
  const existing = getById(id);
  if (!existing) return null;

  const fields: string[] = [];
  const params: unknown[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    params.push(updates.title);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    params.push(updates.description);
  }
  if (updates.importance !== undefined) {
    fields.push('importance = ?');
    params.push(updates.importance);
  }
  if (updates.type !== undefined) {
    fields.push('type = ?');
    params.push(updates.type);
  }
  if (updates.tags !== undefined) {
    fields.push('tags = ?');
    params.push(JSON.stringify(updates.tags));
  }
  if (updates.files !== undefined) {
    fields.push('files = ?');
    params.push(JSON.stringify(updates.files));
  }
  if (updates.features !== undefined) {
    fields.push('features = ?');
    params.push(JSON.stringify(updates.features));
  }
  if (updates.metadata !== undefined) {
    fields.push('metadata = ?');
    params.push(JSON.stringify(updates.metadata));
  }

  if (fields.length === 0) return existing;

  params.push(Number(id));
  db.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`).run(...params);

  // Construct updated memory from existing + updates instead of another DB query
  // This eliminates the N+1 pattern (was calling getById twice)
  return {
    ...existing,
    title: updates.title ?? existing.title,
    description: updates.description ?? existing.description,
    importance: updates.importance ?? existing.importance,
    type: updates.type ?? existing.type,
    tags: updates.tags ?? existing.tags,
    files: updates.files ?? existing.files,
    features: updates.features ?? existing.features,
    metadata: updates.metadata ?? existing.metadata,
  };
}
