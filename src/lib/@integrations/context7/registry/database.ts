/**
 * @module lib/@integrations/context7/registry/database
 * @description Registry database operations (mappings, topics, stats)
 *
 * This module provides database operations for:
 * - Library ID mappings (npm name -> Context7 ID)
 * - Library topics with usage tracking
 * - Registry statistics
 */

// Use factory to access storage (proper layer separation)
import { getRegistryDatabase } from '../factory';
import type { LibraryMapping, LibraryTopic, RegistryStats } from '../types';

// Alias for backward compatibility within this file
const getDatabase = getRegistryDatabase;

import { DEFAULT_MAPPINGS, DEFAULT_TOPICS } from './defaults';

/**
 * Initialize registry tables if they don't exist.
 * Called automatically on first use.
 */
export function ensureRegistryTables(): void {
  const db = getDatabase();

  db.exec(`
    -- Library ID mappings (npm name -> Context7 ID)
    CREATE TABLE IF NOT EXISTS library_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      npm_name TEXT NOT NULL UNIQUE,
      context7_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      stars INTEGER DEFAULT 0,
      benchmark_score INTEGER DEFAULT 0,
      resolved_at TEXT NOT NULL,
      is_manual INTEGER DEFAULT 0
    );

    -- Indexes for fast lookup
    CREATE INDEX IF NOT EXISTS idx_library_mappings_npm ON library_mappings(npm_name);
    CREATE INDEX IF NOT EXISTS idx_library_mappings_context7 ON library_mappings(context7_id);

    -- Library topics with usage tracking
    CREATE TABLE IF NOT EXISTS library_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      context7_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      usage_count INTEGER DEFAULT 0,
      last_used_at TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      UNIQUE(context7_id, topic)
    );

    -- Indexes for topic queries
    CREATE INDEX IF NOT EXISTS idx_library_topics_context7 ON library_topics(context7_id);
    CREATE INDEX IF NOT EXISTS idx_library_topics_usage ON library_topics(usage_count DESC);
  `);
}

/**
 * Get mapping from cache by npm name.
 */
export function getCachedMapping(npmName: string): LibraryMapping | null {
  ensureRegistryTables();
  const db = getDatabase();
  const normalized = npmName.toLowerCase().trim();

  const row = db
    .prepare(`
    SELECT id, npm_name, context7_id, display_name, stars, benchmark_score, resolved_at, is_manual
    FROM library_mappings
    WHERE LOWER(npm_name) = ?
  `)
    .get(normalized) as Record<string, unknown> | undefined;

  if (!row) return null;

  return {
    id: Number(row.id),
    npmName: row.npm_name as string,
    context7Id: row.context7_id as string,
    displayName: row.display_name as string,
    stars: Number(row.stars ?? 0),
    benchmarkScore: Number(row.benchmark_score ?? 0),
    resolvedAt: row.resolved_at as string,
    isManual: Boolean(row.is_manual),
  };
}

/**
 * Save mapping to cache.
 */
export function saveMappingToCache(
  npmName: string,
  context7Id: string,
  displayName: string,
  stars: number = 0,
  benchmarkScore: number = 0,
  isManual: boolean = false,
): void {
  ensureRegistryTables();
  const db = getDatabase();
  const now = new Date().toISOString();
  const normalized = npmName.toLowerCase().trim();

  db.prepare(`
    INSERT INTO library_mappings (npm_name, context7_id, display_name, stars, benchmark_score, resolved_at, is_manual)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(npm_name) DO UPDATE SET
      context7_id = excluded.context7_id,
      display_name = excluded.display_name,
      stars = excluded.stars,
      benchmark_score = excluded.benchmark_score,
      resolved_at = excluded.resolved_at
  `).run(normalized, context7Id, displayName, stars, benchmarkScore, now, isManual ? 1 : 0);
}

/**
 * Get topics from cache for a library.
 */
export function getCachedTopics(context7Id: string): LibraryTopic[] {
  ensureRegistryTables();
  const db = getDatabase();

  const rows = db
    .prepare(`
    SELECT id, context7_id, topic, usage_count, last_used_at, is_default
    FROM library_topics
    WHERE context7_id = ?
    ORDER BY usage_count DESC, is_default DESC
  `)
    .all(context7Id) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: Number(row.id),
    context7Id: row.context7_id as string,
    topic: row.topic as string,
    usageCount: Number(row.usage_count ?? 0),
    lastUsedAt: row.last_used_at as string,
    isDefault: Boolean(row.is_default),
  }));
}

/**
 * Save or update a topic for a library.
 */
export function saveTopicToCache(
  context7Id: string,
  topic: string,
  isDefault: boolean = false,
): void {
  ensureRegistryTables();
  const db = getDatabase();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO library_topics (context7_id, topic, usage_count, last_used_at, is_default)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(context7_id, topic) DO UPDATE SET
      usage_count = usage_count + 1,
      last_used_at = excluded.last_used_at
  `).run(context7Id, topic, now, isDefault ? 1 : 0);
}

/**
 * Seed default mappings into cache.
 */
export function seedDefaultMappings(): void {
  for (const mapping of DEFAULT_MAPPINGS) {
    for (const pattern of mapping.patterns) {
      const existing = getCachedMapping(pattern);
      if (!existing) {
        saveMappingToCache(pattern, mapping.context7Id, mapping.displayName, 0, 0, false);
      }
    }
  }
}

/**
 * Seed default topics into cache.
 */
export function seedDefaultTopics(): void {
  for (const [context7Id, topics] of Array.from(DEFAULT_TOPICS.entries())) {
    for (const topic of topics) {
      const cached = getCachedTopics(context7Id);
      const exists = cached.some((t) => t.topic === topic);
      if (!exists) {
        saveTopicToCache(context7Id, topic, true);
      }
    }
  }
}

/**
 * Get all cached library mappings.
 */
export function getAllMappings(): LibraryMapping[] {
  ensureRegistryTables();
  const db = getDatabase();

  const rows = db
    .prepare(`
    SELECT id, npm_name, context7_id, display_name, stars, benchmark_score, resolved_at, is_manual
    FROM library_mappings
    ORDER BY resolved_at DESC
  `)
    .all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: Number(row.id),
    npmName: row.npm_name as string,
    context7Id: row.context7_id as string,
    displayName: row.display_name as string,
    stars: Number(row.stars ?? 0),
    benchmarkScore: Number(row.benchmark_score ?? 0),
    resolvedAt: row.resolved_at as string,
    isManual: Boolean(row.is_manual),
  }));
}

/**
 * Get unique Context7 IDs from mappings.
 */
export function getUniqueLibraryIds(): string[] {
  ensureRegistryTables();
  const db = getDatabase();

  const rows = db
    .prepare(`
    SELECT DISTINCT context7_id
    FROM library_mappings
    ORDER BY context7_id
  `)
    .all() as Array<{ context7_id: string }>;

  return rows.map((r) => r.context7_id);
}

/**
 * Clear all cached mappings and topics.
 */
export function clearRegistry(): void {
  ensureRegistryTables();
  const db = getDatabase();

  db.exec('DELETE FROM library_mappings');
  db.exec('DELETE FROM library_topics');
}

/**
 * Get registry statistics.
 */
export function getRegistryStats(): RegistryStats {
  ensureRegistryTables();
  const db = getDatabase();

  const mappingsRow = db.prepare('SELECT COUNT(*) as count FROM library_mappings').get() as {
    count: number;
  };
  const uniqueRow = db
    .prepare('SELECT COUNT(DISTINCT context7_id) as count FROM library_mappings')
    .get() as { count: number };
  const topicsRow = db.prepare('SELECT COUNT(*) as count FROM library_topics').get() as {
    count: number;
  };
  const manualRow = db
    .prepare('SELECT COUNT(*) as count FROM library_mappings WHERE is_manual = 1')
    .get() as { count: number };

  return {
    totalMappings: mappingsRow.count,
    uniqueLibraries: uniqueRow.count,
    totalTopics: topicsRow.count,
    manualMappings: manualRow.count,
  };
}
