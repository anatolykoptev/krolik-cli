/**
 * @module lib/@storage/memory/links
 * @description Memory graph relationships management
 *
 * Provides:
 * - Create/delete links between memories
 * - Query linked memories (forward/backward)
 * - Traverse memory chains
 * - Find superseded (outdated) memories
 */

import { getDatabase, prepareStatement } from '../database';
import { rowToMemory } from './converters';
import type { Memory } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Types of relationships between memories
 */
export type LinkType =
  | 'caused' // This memory caused/led to the linked memory
  | 'related' // General relationship
  | 'supersedes' // This memory replaces the linked memory
  | 'implements' // This memory implements the linked decision
  | 'contradicts'; // This memory contradicts the linked memory

/**
 * Memory link record
 */
export interface MemoryLink {
  id: number;
  fromId: number;
  toId: number;
  linkType: LinkType;
  createdAt: string;
}

/**
 * Memory with link information
 */
export interface LinkedMemory {
  memory: Memory;
  linkType: LinkType;
  direction: 'from' | 'to';
}

/**
 * All link types
 */
export const ALL_LINK_TYPES: readonly LinkType[] = [
  'caused',
  'related',
  'supersedes',
  'implements',
  'contradicts',
] as const;

// ============================================================================
// LINK OPERATIONS
// ============================================================================

/**
 * Create a link between two memories
 *
 * @param fromId - Source memory ID
 * @param toId - Target memory ID
 * @param linkType - Type of relationship
 * @returns The created link or null if failed
 *
 * @example
 * ```typescript
 * // Decision 123 led to bugfix 456
 * createLink(123, 456, 'caused');
 *
 * // Decision 789 supersedes decision 123
 * createLink(789, 123, 'supersedes');
 * ```
 */
export function createLink(fromId: number, toId: number, linkType: LinkType): MemoryLink | null {
  if (fromId === toId) {
    return null; // Can't link to self
  }

  const db = getDatabase();

  try {
    const sql = `
      INSERT INTO memory_links (from_id, to_id, link_type)
      VALUES (?, ?, ?)
      RETURNING id, from_id, to_id, link_type, created_at
    `;

    const row = prepareStatement<
      [number, number, string],
      { id: number; from_id: number; to_id: number; link_type: string; created_at: string }
    >(db, sql).get(fromId, toId, linkType);

    if (!row) return null;

    return {
      id: row.id,
      fromId: row.from_id,
      toId: row.to_id,
      linkType: row.link_type as LinkType,
      createdAt: row.created_at,
    };
  } catch {
    // Link already exists or invalid IDs
    return null;
  }
}

/**
 * Delete a link between two memories
 *
 * @param fromId - Source memory ID
 * @param toId - Target memory ID
 * @param linkType - Optional: specific link type to delete (all if not specified)
 * @returns Number of deleted links
 */
export function deleteLink(fromId: number, toId: number, linkType?: LinkType): number {
  const db = getDatabase();

  const sql = linkType
    ? 'DELETE FROM memory_links WHERE from_id = ? AND to_id = ? AND link_type = ?'
    : 'DELETE FROM memory_links WHERE from_id = ? AND to_id = ?';

  const params = linkType ? [fromId, toId, linkType] : [fromId, toId];
  const result = db.prepare(sql).run(...params);

  return result.changes;
}

/**
 * Delete all links for a memory
 *
 * @param memoryId - Memory ID
 * @returns Number of deleted links
 */
export function deleteAllLinks(memoryId: number): number {
  const db = getDatabase();

  const sql = 'DELETE FROM memory_links WHERE from_id = ? OR to_id = ?';
  const result = db.prepare(sql).run(memoryId, memoryId);

  return result.changes;
}

/**
 * Get link between two memories
 *
 * @param fromId - Source memory ID
 * @param toId - Target memory ID
 * @param linkType - Optional: specific link type
 */
export function getLink(fromId: number, toId: number, linkType?: LinkType): MemoryLink | null {
  const db = getDatabase();

  const sql = linkType
    ? 'SELECT * FROM memory_links WHERE from_id = ? AND to_id = ? AND link_type = ?'
    : 'SELECT * FROM memory_links WHERE from_id = ? AND to_id = ? LIMIT 1';

  const params = linkType ? [fromId, toId, linkType] : [fromId, toId];
  const row = db.prepare(sql).get(...params) as
    | { id: number; from_id: number; to_id: number; link_type: string; created_at: string }
    | undefined;

  if (!row) return null;

  return {
    id: row.id,
    fromId: row.from_id,
    toId: row.to_id,
    linkType: row.link_type as LinkType,
    createdAt: row.created_at,
  };
}

// ============================================================================
// QUERY LINKED MEMORIES
// ============================================================================

/**
 * Get all memories linked FROM this memory (outgoing links)
 *
 * @param memoryId - Source memory ID
 * @param linkType - Optional: filter by link type
 * @returns Array of linked memories with relationship info
 *
 * @example
 * ```typescript
 * // Get all memories caused by decision 123
 * const caused = getLinkedFrom(123, 'caused');
 *
 * // Get all links from decision 123
 * const all = getLinkedFrom(123);
 * ```
 */
export function getLinkedFrom(memoryId: number, linkType?: LinkType): LinkedMemory[] {
  const db = getDatabase();

  const sql = linkType
    ? `SELECT m.*, ml.link_type FROM memories m
       JOIN memory_links ml ON m.id = ml.to_id
       WHERE ml.from_id = ? AND ml.link_type = ?
       ORDER BY m.created_at_epoch DESC`
    : `SELECT m.*, ml.link_type FROM memories m
       JOIN memory_links ml ON m.id = ml.to_id
       WHERE ml.from_id = ?
       ORDER BY m.created_at_epoch DESC`;

  const params = linkType ? [memoryId, linkType] : [memoryId];
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    memory: rowToMemory(row),
    linkType: row.link_type as LinkType,
    direction: 'from' as const,
  }));
}

/**
 * Get all memories linked TO this memory (incoming links)
 *
 * @param memoryId - Target memory ID
 * @param linkType - Optional: filter by link type
 * @returns Array of linked memories with relationship info
 *
 * @example
 * ```typescript
 * // Get all decisions that this bugfix implements
 * const decisions = getLinkedTo(456, 'implements');
 * ```
 */
export function getLinkedTo(memoryId: number, linkType?: LinkType): LinkedMemory[] {
  const db = getDatabase();

  const sql = linkType
    ? `SELECT m.*, ml.link_type FROM memories m
       JOIN memory_links ml ON m.id = ml.from_id
       WHERE ml.to_id = ? AND ml.link_type = ?
       ORDER BY m.created_at_epoch DESC`
    : `SELECT m.*, ml.link_type FROM memories m
       JOIN memory_links ml ON m.id = ml.from_id
       WHERE ml.to_id = ?
       ORDER BY m.created_at_epoch DESC`;

  const params = linkType ? [memoryId, linkType] : [memoryId];
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    memory: rowToMemory(row),
    linkType: row.link_type as LinkType,
    direction: 'to' as const,
  }));
}

/**
 * Get all links for a memory (both directions)
 *
 * @param memoryId - Memory ID
 * @param linkType - Optional: filter by link type
 */
export function getAllLinks(memoryId: number, linkType?: LinkType): LinkedMemory[] {
  const from = getLinkedFrom(memoryId, linkType);
  const to = getLinkedTo(memoryId, linkType);
  return [...from, ...to];
}

// ============================================================================
// GRAPH TRAVERSAL
// ============================================================================

/**
 * Get memory chain by traversing the graph
 *
 * @param memoryId - Starting memory ID
 * @param direction - Traversal direction
 * @param maxDepth - Maximum traversal depth (default: 3)
 * @returns Array of memories in the chain
 *
 * @example
 * ```typescript
 * // Get full chain of decisions and consequences
 * const chain = getMemoryChain(123, 'forward', 5);
 *
 * // Get what led to this bugfix
 * const causes = getMemoryChain(456, 'backward', 3);
 * ```
 */
export function getMemoryChain(
  memoryId: number,
  direction: 'forward' | 'backward' | 'both' = 'both',
  maxDepth = 3,
): Memory[] {
  const db = getDatabase();
  const visited = new Set<number>();
  const result: Memory[] = [];

  function traverse(id: number, depth: number): void {
    if (depth > maxDepth || visited.has(id)) return;
    visited.add(id);

    // Get the memory
    const sql = 'SELECT * FROM memories WHERE id = ?';
    const row = prepareStatement<[number], Record<string, unknown>>(db, sql).get(id);

    if (row) {
      result.push(rowToMemory(row));
    }

    // Traverse forward (outgoing links)
    if (direction === 'forward' || direction === 'both') {
      const linkedFrom = getLinkedFrom(id);
      for (const { memory } of linkedFrom) {
        traverse(Number.parseInt(memory.id, 10), depth + 1);
      }
    }

    // Traverse backward (incoming links)
    if (direction === 'backward' || direction === 'both') {
      const linkedTo = getLinkedTo(id);
      for (const { memory } of linkedTo) {
        traverse(Number.parseInt(memory.id, 10), depth + 1);
      }
    }
  }

  traverse(memoryId, 0);
  return result;
}

// ============================================================================
// SUPERSEDED MEMORIES
// ============================================================================

/**
 * Get superseded (outdated) memories
 *
 * Returns memories that have been replaced by newer decisions.
 *
 * @param project - Optional: filter by project
 * @returns Array of superseded memories
 *
 * @example
 * ```typescript
 * // Get all outdated decisions
 * const outdated = getSupersededMemories('my-project');
 * ```
 */
export function getSupersededMemories(project?: string): Memory[] {
  const db = getDatabase();

  const sql = project
    ? `SELECT m.* FROM memories m
       JOIN memory_links ml ON m.id = ml.to_id
       WHERE ml.link_type = 'supersedes' AND m.project = ?
       ORDER BY m.created_at_epoch DESC`
    : `SELECT m.* FROM memories m
       JOIN memory_links ml ON m.id = ml.to_id
       WHERE ml.link_type = 'supersedes'
       ORDER BY m.created_at_epoch DESC`;

  const params = project ? [project] : [];
  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;

  return rows.map(rowToMemory);
}

/**
 * Get the memory that supersedes a given memory
 *
 * @param memoryId - ID of potentially superseded memory
 * @returns The superseding memory or null
 */
export function getSupersedingMemory(memoryId: number): Memory | null {
  const linked = getLinkedTo(memoryId, 'supersedes');
  const first = linked[0];
  return first ? first.memory : null;
}

/**
 * Check if a memory is superseded
 *
 * @param memoryId - Memory ID
 */
export function isSuperseded(memoryId: number): boolean {
  return getSupersedingMemory(memoryId) !== null;
}

// ============================================================================
// STATS
// ============================================================================

/**
 * Get link statistics
 */
export function getLinkStats(): {
  total: number;
  byType: Record<LinkType, number>;
} {
  const db = getDatabase();

  const totalSql = 'SELECT COUNT(*) as count FROM memory_links';
  const totalRow = prepareStatement<[], { count: number }>(db, totalSql).get();

  const byTypeSql = 'SELECT link_type, COUNT(*) as count FROM memory_links GROUP BY link_type';
  const byTypeRows = db.prepare(byTypeSql).all() as Array<{ link_type: string; count: number }>;

  const byType: Record<LinkType, number> = {
    caused: 0,
    related: 0,
    supersedes: 0,
    implements: 0,
    contradicts: 0,
  };

  for (const row of byTypeRows) {
    byType[row.link_type as LinkType] = row.count;
  }

  return {
    total: totalRow?.count ?? 0,
    byType,
  };
}
