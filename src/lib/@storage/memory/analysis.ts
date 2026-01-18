/**
 * @module lib/@storage/memory/analysis
 * @description Core logic for analyzing memories and promoting them to skills
 */

import { getDatabase } from '../database';
import { createGuardrail, type GuardrailCategory } from '../felix';
import { clusterMemories, filterSkillCandidates, type MemoryCluster } from './clustering';
import { rowToMemory } from './converters';

export interface AnalysisOptions {
  minCount?: number;
  threshold?: number;
}

/**
 * Find potential skills by analyzing memory clusters
 */
export function findSkillCandidates(
  project: string,
  options: AnalysisOptions = {},
): MemoryCluster[] {
  const minCount = options.minCount ?? 5;
  const threshold = options.threshold ?? 0.6;

  // 1. Fetch memories
  const db = getDatabase();
  const rows = db
    .prepare(`
        SELECT * FROM memories 
        WHERE project = ? 
        ORDER BY created_at_epoch DESC 
        LIMIT 1000
    `)
    .all(project) as Record<string, unknown>[];

  const memories = rows.map(rowToMemory);

  // 2. Cluster
  const clusters = clusterMemories(memories, threshold);

  // 3. Filter
  return filterSkillCandidates(clusters, minCount);
}

/**
 * Promote a cluster to a skill (Guardrail)
 */
export function promoteClusterToGuardrail(project: string, cluster: MemoryCluster): number {
  // Use centroid data for creation
  return createGuardrail({
    project,
    type: cluster.centroid.type, // Preserve original type
    category: 'quality' as GuardrailCategory, // Default for auto-promoted
    severity: cluster.centroid.importance === 'critical' ? 'critical' : 'medium',
    title: cluster.label,
    problem: cluster.centroid.description,
    solution: 'Derived from repeated patterns. Please refine.', // Placeholder for AI to refine later
    tags: cluster.centroid.tags,
  });
}
