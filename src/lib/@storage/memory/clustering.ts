/**
 * @module lib/@storage/memory/clustering
 * @description Memory clustering algorithms for pattern detection
 */

import { cosineSimilarity } from './embeddings';
import { getEmbedding } from './semantic-search';
import type { Memory } from './types';

/**
 * Cluster of related memories
 */
export interface MemoryCluster {
  id: string;
  centroid: Memory;
  members: Memory[];
  score: number;
  label: string; // Auto-generated label (usually title of centroid)
}

/**
 * Calculate Jaccard similarity between two texts (word-based)
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
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
 * Calculate combined similarity (Text + Semantic if available)
 */
/**
 * Calculate combined similarity (Text + Semantic if available)
 */
function calculateSimilarity(m1: Memory, m2: Memory): number {
  // 1. Text Similarity (Base)
  const titleSim = calculateTextSimilarity(m1.title, m2.title);
  const descSim = calculateTextSimilarity(m1.description, m2.description);

  // Weighted text score
  const textScore = titleSim * 0.6 + descSim * 0.4;

  // 2. Semantic Similarity (Enhancement)
  // We try to fetch embeddings from DB. If present, we use them.
  // This does not require the embedding model to be loaded in memory.
  const id1 = parseInt(m1.id, 10);
  const id2 = parseInt(m2.id, 10);

  if (!isNaN(id1) && !isNaN(id2)) {
    const e1 = getEmbedding(id1);
    const e2 = getEmbedding(id2);

    if (e1 && e2) {
      const semanticScore = cosineSimilarity(e1, e2);
      // Hybrid score: 40% text, 60% semantic (semantic is usually more accurate for meaning)
      return textScore * 0.4 + semanticScore * 0.6;
    }
  }

  return textScore;
}

/**
 * Cluster memories using a greedy algorithm
 * @param memories List of memories to cluster
 * @param threshold Similarity threshold (0.0 - 1.0)
 */
export function clusterMemories(memories: Memory[], threshold = 0.6): MemoryCluster[] {
  const clusters: MemoryCluster[] = [];
  const processed = new Set<string>();

  // Sort by length/complexity to prioritize "richer" memories as centroids?
  // Or just process sequentially. Processing sequentially is fine for greedy.

  for (const memory of memories) {
    if (processed.has(memory.id)) continue;

    // Start a new cluster
    const cluster: MemoryCluster = {
      id: `cluster_${memory.id}`,
      centroid: memory,
      members: [memory],
      score: 1.0,
      label: memory.title,
    };
    processed.add(memory.id);

    // Look for members
    for (const candidate of memories) {
      if (processed.has(candidate.id)) continue;

      const sim = calculateSimilarity(memory, candidate);
      if (sim >= threshold) {
        cluster.members.push(candidate);
        processed.add(candidate.id);
      }
    }

    // Only keep clusters with members (or allow singletons if needed, but for "patterns" we want > 1)
    clusters.push(cluster);
  }

  // Sort clusters by size (largest first)
  return clusters.sort((a, b) => b.members.length - a.members.length);
}

/**
 * Analyze clusters to find valid skill candidates
 * @param clusters All clusters
 * @param minSize Minimum size to be considered a pattern (e.g. 5)
 */
export function filterSkillCandidates(clusters: MemoryCluster[], minSize = 5): MemoryCluster[] {
  return clusters.filter((c) => c.members.length >= minSize);
}
