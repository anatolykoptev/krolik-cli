/**
 * @module lib/@storage/memory/consolidation
 * @description Memory consolidation - detect and merge similar entries
 *
 * Implements Google-style memory management:
 * - Detect duplicate/similar memories
 * - Suggest merges for related entries
 * - Clean up stale memories
 */

import { getDatabase, prepareStatement } from '../database';
import { rowToMemory } from './converters';
import type { Memory } from './types';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Similarity match between two memories
 */
export interface SimilarityMatch {
  memory1: Memory;
  memory2: Memory;
  similarity: number;
  reason: string;
  suggestedAction: 'merge' | 'keep-both' | 'delete-older';
}

/**
 * Consolidation result
 */
export interface ConsolidationResult {
  /** Number of duplicate groups found */
  duplicateGroups: number;
  /** Similar memories that could be merged */
  similarMatches: SimilarityMatch[];
  /** Stale memories (old and low importance) */
  staleCount: number;
  /** Orphaned memories (project no longer exists) */
  orphanedCount: number;
}

// ============================================================================
// SIMILARITY DETECTION
// ============================================================================

/**
 * Calculate similarity between two strings (Jaccard similarity on words)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    text1
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );
  const words2 = new Set(
    text2
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2),
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Calculate tag similarity
 */
function calculateTagSimilarity(tags1: string[], tags2: string[]): number {
  if (tags1.length === 0 || tags2.length === 0) return 0;

  const set1 = new Set(tags1.map((t) => t.toLowerCase()));
  const set2 = new Set(tags2.map((t) => t.toLowerCase()));

  const intersection = new Set([...set1].filter((t) => set2.has(t)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Calculate overall similarity between two memories
 */
function calculateMemorySimilarity(m1: Memory, m2: Memory): number {
  // Title similarity (weight: 0.4)
  const titleSim = calculateTextSimilarity(m1.title, m2.title);

  // Description similarity (weight: 0.3)
  const descSim = calculateTextSimilarity(m1.description, m2.description);

  // Tag similarity (weight: 0.2)
  const tagSim = calculateTagSimilarity(m1.tags, m2.tags);

  // Type match (weight: 0.1)
  const typeMatch = m1.type === m2.type ? 1 : 0;

  return titleSim * 0.4 + descSim * 0.3 + tagSim * 0.2 + typeMatch * 0.1;
}

/**
 * Determine suggested action based on similarity and age
 */
function suggestAction(
  m1: Memory,
  m2: Memory,
  similarity: number,
): SimilarityMatch['suggestedAction'] {
  // Very high similarity (>0.8) - likely duplicates
  if (similarity > 0.8) {
    // If same importance, keep newer
    if (m1.importance === m2.importance) {
      return 'delete-older';
    }

    // If different importance, merge into higher importance one
    return 'merge';
  }

  // Medium similarity (0.5-0.8) - related, consider merging
  if (similarity > 0.5) {
    return 'merge';
  }

  // Low similarity - keep both
  return 'keep-both';
}

// ============================================================================
// CONSOLIDATION
// ============================================================================

/**
 * Find similar memories for potential consolidation
 */
export function findSimilarMemories(
  project: string,
  threshold = 0.5,
  limit = 20,
): SimilarityMatch[] {
  const db = getDatabase();

  // Get recent memories for comparison
  const sql = `
    SELECT * FROM memories
    WHERE project = ?
    ORDER BY created_at_epoch DESC
    LIMIT 100
  `;

  const stmt = prepareStatement<[string], Record<string, unknown>>(db, sql);
  const rows = stmt.all(project);
  const memories = rows.map(rowToMemory);

  const matches: SimilarityMatch[] = [];

  // Compare each pair (O(n²) but limited to 100 memories)
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const m1 = memories[i];
      const m2 = memories[j];

      if (!m1 || !m2) continue;

      const similarity = calculateMemorySimilarity(m1, m2);

      if (similarity >= threshold) {
        matches.push({
          memory1: m1,
          memory2: m2,
          similarity: Math.round(similarity * 100) / 100,
          reason: generateSimilarityReason(m1, m2, similarity),
          suggestedAction: suggestAction(m1, m2, similarity),
        });
      }
    }
  }

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches.slice(0, limit);
}

/**
 * Generate human-readable reason for similarity
 */
function generateSimilarityReason(m1: Memory, m2: Memory, similarity: number): string {
  const reasons: string[] = [];

  // Title similarity
  if (calculateTextSimilarity(m1.title, m2.title) > 0.6) {
    reasons.push('similar titles');
  }

  // Same type
  if (m1.type === m2.type) {
    reasons.push(`both ${m1.type}s`);
  }

  // Shared tags
  const sharedTags = m1.tags.filter((t) => m2.tags.includes(t));
  if (sharedTags.length > 0) {
    reasons.push(`shared tags: ${sharedTags.join(', ')}`);
  }

  // Shared features
  if (m1.features && m2.features) {
    const sharedFeatures = m1.features.filter((f) => m2.features?.includes(f));
    if (sharedFeatures.length > 0) {
      reasons.push(`same feature: ${sharedFeatures.join(', ')}`);
    }
  }

  return reasons.length > 0 ? reasons.join(', ') : `${Math.round(similarity * 100)}% similar`;
}

/**
 * Find stale memories (old + low importance)
 */
export function findStaleMemories(project: string, maxAgeDays = 90, limit = 20): Memory[] {
  const db = getDatabase();
  const cutoffEpoch = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  const sql = `
    SELECT * FROM memories
    WHERE project = ?
    AND created_at_epoch < ?
    AND importance IN ('low', 'medium')
    ORDER BY created_at_epoch ASC
    LIMIT ?
  `;

  const stmt = prepareStatement<[string, number, number], Record<string, unknown>>(db, sql);
  const rows = stmt.all(project, cutoffEpoch, limit);

  return rows.map(rowToMemory);
}

/**
 * Run full consolidation analysis
 */
export function analyzeConsolidation(project: string): ConsolidationResult {
  const similarMatches = findSimilarMemories(project, 0.5, 20);
  const staleMemories = findStaleMemories(project, 90, 50);

  // Count duplicate groups (similarity > 0.8)
  const duplicateGroups = similarMatches.filter((m) => m.similarity > 0.8).length;

  return {
    duplicateGroups,
    similarMatches: similarMatches.filter((m) => m.similarity <= 0.8), // Exclude exact duplicates
    staleCount: staleMemories.length,
    orphanedCount: 0, // TODO: Implement orphan detection
  };
}

// ============================================================================
// CLEANUP
// ============================================================================

/**
 * Delete a memory by ID
 */
export function deleteMemory(id: string): boolean {
  const db = getDatabase();

  const sql = 'DELETE FROM memories WHERE id = ?';
  const stmt = prepareStatement<[number]>(db, sql);
  const result = stmt.run(Number.parseInt(id, 10));

  return result.changes > 0;
}

/**
 * Merge two memories into one
 * Keeps the first memory, updates it with combined info, deletes the second
 */
export function mergeMemories(keepId: string, deleteId: string): boolean {
  const db = getDatabase();

  // Get both memories
  const getSql = 'SELECT * FROM memories WHERE id = ?';
  const getStmt = prepareStatement<[number], Record<string, unknown>>(db, getSql);

  const keepRow = getStmt.get(Number.parseInt(keepId, 10));
  const deleteRow = getStmt.get(Number.parseInt(deleteId, 10));

  if (!keepRow || !deleteRow) {
    return false;
  }

  const keepMemory = rowToMemory(keepRow);
  const deleteMemory = rowToMemory(deleteRow);

  // Merge tags
  const mergedTags = [...new Set([...keepMemory.tags, ...deleteMemory.tags])];

  // Merge features
  const mergedFeatures = [
    ...new Set([...(keepMemory.features ?? []), ...(deleteMemory.features ?? [])]),
  ];

  // Merge files
  const mergedFiles = [...new Set([...(keepMemory.files ?? []), ...(deleteMemory.files ?? [])])];

  // Combine descriptions if different
  let mergedDescription = keepMemory.description;
  if (keepMemory.description !== deleteMemory.description) {
    mergedDescription = `${keepMemory.description}\n\n[Merged from: ${deleteMemory.title}]\n${deleteMemory.description}`;
  }

  // Update the kept memory
  const updateSql = `
    UPDATE memories
    SET description = ?, tags = ?, features = ?, files = ?
    WHERE id = ?
  `;
  const updateStmt = prepareStatement<[string, string, string, string, number]>(db, updateSql);
  updateStmt.run(
    mergedDescription,
    JSON.stringify(mergedTags),
    JSON.stringify(mergedFeatures),
    JSON.stringify(mergedFiles),
    Number.parseInt(keepId, 10),
  );

  // Delete the merged memory
  const deleteSql = 'DELETE FROM memories WHERE id = ?';
  const deleteStmt = prepareStatement<[number]>(db, deleteSql);
  deleteStmt.run(Number.parseInt(deleteId, 10));

  return true;
}

/**
 * Clean up stale memories (delete old, low-importance entries)
 */
export function cleanupStaleMemories(
  project: string,
  maxAgeDays = 180,
  dryRun = true,
): { count: number; memories: Memory[] } {
  const staleMemories = findStaleMemories(project, maxAgeDays, 100);

  if (dryRun) {
    return {
      count: staleMemories.length,
      memories: staleMemories,
    };
  }

  // Actually delete
  for (const memory of staleMemories) {
    deleteMemory(memory.id);
  }

  return {
    count: staleMemories.length,
    memories: staleMemories,
  };
}
