/**
 * @module lib/@storage/memory/crud
 * @description CRUD operations for memories (save, getById, remove, update, promote)
 *
 * Supports hybrid memory architecture:
 * - Project-scoped memories (default for decisions, bugfixes, features)
 * - Global memories (patterns, library docs, snippets, anti-patterns)
 */

import { getDatabase } from '../database';
import { DEFAULT_IMPORTANCE } from './constants';
import { rowToMemory } from './converters';
import { storeEmbedding } from './semantic-search';
import type {
  GlobalMemorySaveOptions,
  Memory,
  MemoryContext,
  MemorySaveOptions,
  MemorySource,
} from './types';
import { inferScope } from './types';

// ============================================================================
// SAVE OPERATIONS
// ============================================================================

/**
 * Save memory to database with automatic embedding generation
 * @param options - Memory content options
 * @param context - Project context (project, branch, commit)
 * @returns Created Memory object
 */
export async function save(options: MemorySaveOptions, context: MemoryContext): Promise<Memory> {
  const db = getDatabase();
  const now = new Date();

  // Infer scope from type if not explicitly provided
  const scope = options.scope ?? inferScope(options.type);
  const source = options.source ?? 'manual';

  const stmt = db.prepare(`
    INSERT INTO memories (
      type, title, description, importance, project, branch, commit_hash,
      tags, files, features, metadata, created_at, created_at_epoch,
      scope, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    scope,
    source,
  );

  const memoryId = Number(result.lastInsertRowid);

  // Generate embedding asynchronously (fire and forget, don't block save)
  const embeddingText = `${options.title} ${options.description}`;
  storeEmbedding(memoryId, embeddingText).catch(() => {
    // Silently ignore embedding errors - semantic search will work without it
  });

  return {
    id: String(memoryId),
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
    scope,
    source,
    usageCount: 0,
  };
}

/**
 * Save global memory (no project context required) with automatic embedding generation
 * @param options - Global memory options
 * @returns Created Memory object
 */
export async function saveGlobal(options: GlobalMemorySaveOptions): Promise<Memory> {
  const db = getDatabase();
  const now = new Date();

  const source = options.source ?? 'manual';

  const stmt = db.prepare(`
    INSERT INTO memories (
      type, title, description, importance, project, branch, commit_hash,
      tags, files, features, metadata, created_at, created_at_epoch,
      scope, source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    options.type,
    options.title,
    options.description,
    options.importance ?? DEFAULT_IMPORTANCE,
    '_global', // Special project name for global memories
    null,
    null,
    JSON.stringify(options.tags ?? []),
    JSON.stringify([]),
    JSON.stringify([]),
    JSON.stringify(options.metadata ?? {}),
    now.toISOString(),
    now.getTime(),
    'global',
    source,
  );

  const memoryId = Number(result.lastInsertRowid);

  // Generate embedding asynchronously (fire and forget, don't block save)
  const embeddingText = `${options.title} ${options.description}`;
  storeEmbedding(memoryId, embeddingText).catch(() => {
    // Silently ignore embedding errors - semantic search will work without it
  });

  return {
    id: String(memoryId),
    type: options.type,
    title: options.title,
    description: options.description,
    importance: options.importance ?? DEFAULT_IMPORTANCE,
    project: '_global',
    tags: options.tags ?? [],
    createdAt: now.toISOString(),
    metadata: options.metadata,
    scope: 'global',
    source,
    usageCount: 0,
  };
}

// ============================================================================
// READ OPERATIONS
// ============================================================================

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
 * Get all global memories
 * @param limit - Maximum number of memories to return
 * @returns Array of global Memory objects
 */
export function getGlobalMemories(limit = 50): Memory[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT * FROM memories
       WHERE scope = 'global'
       ORDER BY usage_count DESC, created_at_epoch DESC
       LIMIT ?`,
    )
    .all(limit) as Record<string, unknown>[];

  return rows.map(rowToMemory);
}

// ============================================================================
// UPDATE OPERATIONS
// ============================================================================

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
  if (updates.scope !== undefined) {
    fields.push('scope = ?');
    params.push(updates.scope);
  }
  if (updates.source !== undefined) {
    fields.push('source = ?');
    params.push(updates.source);
  }

  if (fields.length === 0) return existing;

  params.push(Number(id));
  db.prepare(`UPDATE memories SET ${fields.join(', ')} WHERE id = ?`).run(...params);

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
    scope: updates.scope ?? existing.scope,
    source: updates.source ?? existing.source,
  };
}

/**
 * Increment usage count for a memory (called when memory is retrieved in search)
 * @param id - Memory ID
 */
export function incrementUsage(id: string): void {
  const db = getDatabase();
  db.prepare(
    `UPDATE memories
     SET usage_count = usage_count + 1, last_used_at = ?
     WHERE id = ?`,
  ).run(new Date().toISOString(), Number(id));
}

// ============================================================================
// PROMOTE OPERATIONS
// ============================================================================

/**
 * Promote a project memory to global scope
 * Creates a copy in global scope with source='promoted'
 *
 * @param id - Memory ID to promote
 * @returns Promoted Memory object or null if not found
 */
export async function promote(id: string): Promise<Memory | null> {
  const existing = getById(id);
  if (!existing) return null;

  // Already global
  if (existing.scope === 'global') {
    return existing;
  }

  const db = getDatabase();
  const now = new Date();

  const stmt = db.prepare(`
    INSERT INTO memories (
      type, title, description, importance, project, branch, commit_hash,
      tags, files, features, metadata, created_at, created_at_epoch,
      scope, source, original_project, original_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    existing.type,
    existing.title,
    existing.description,
    existing.importance,
    '_global', // Global project marker
    null,
    null,
    JSON.stringify(existing.tags),
    JSON.stringify(existing.files ?? []),
    JSON.stringify(existing.features ?? []),
    JSON.stringify(existing.metadata ?? {}),
    now.toISOString(),
    now.getTime(),
    'global',
    'promoted',
    existing.project,
    Number(existing.id),
  );

  const memoryId = Number(result.lastInsertRowid);

  // Generate embedding asynchronously (fire and forget)
  const embeddingText = `${existing.title} ${existing.description}`;
  storeEmbedding(memoryId, embeddingText).catch(() => {
    // Silently ignore embedding errors
  });

  return {
    id: String(memoryId),
    type: existing.type,
    title: existing.title,
    description: existing.description,
    importance: existing.importance,
    project: '_global',
    tags: existing.tags,
    files: existing.files,
    features: existing.features,
    createdAt: now.toISOString(),
    metadata: existing.metadata,
    scope: 'global',
    source: 'promoted',
    usageCount: 0,
    originalProject: existing.project,
    originalId: Number(existing.id),
  };
}

// ============================================================================
// STATS
// ============================================================================

/**
 * Get memory counts by scope
 */
export function getCountsByScope(): { project: number; global: number } {
  const db = getDatabase();

  const projectCount = db
    .prepare("SELECT COUNT(*) as count FROM memories WHERE scope = 'project' OR scope IS NULL")
    .get() as { count: number };

  const globalCount = db
    .prepare("SELECT COUNT(*) as count FROM memories WHERE scope = 'global'")
    .get() as { count: number };

  return {
    project: projectCount.count,
    global: globalCount.count,
  };
}

/**
 * Get memory counts by source
 */
export function getCountsBySource(): Record<MemorySource, number> {
  const db = getDatabase();

  const rows = db
    .prepare(
      `SELECT COALESCE(source, 'manual') as source, COUNT(*) as count
       FROM memories
       GROUP BY source`,
    )
    .all() as Array<{ source: MemorySource; count: number }>;

  const result: Record<MemorySource, number> = {
    manual: 0,
    context7: 0,
    'ai-generated': 0,
    promoted: 0,
  };

  for (const row of rows) {
    result[row.source] = row.count;
  }

  return result;
}
