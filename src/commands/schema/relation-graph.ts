/**
 * @module commands/schema/relation-graph
 * @description Build and analyze relation graph from Prisma models
 *
 * Uses graph algorithms to detect model clusters and core entities.
 * Reuses Tarjan SCC from refactor/analyzers/ranking/safe-order.ts
 */

import type { PrismaModel } from './parser';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Node in the relation graph
 */
export interface RelationNode {
  /** Model name */
  model: string;
  /** Filename (for fallback grouping) */
  file: string;
  /** Outgoing relations (models this model references) */
  relations: string[];
  /** Incoming relations (models that reference this model) */
  referencedBy: string[];
  /** Afferent coupling (number of incoming references) */
  inDegree: number;
  /** Efferent coupling (number of outgoing references) */
  outDegree: number;
}

/**
 * Detected domain/cluster of related models
 */
export interface ModelCluster {
  /** Inferred domain name */
  name: string;
  /** Core entity (highest inDegree) */
  core: string | null;
  /** All models in this cluster */
  models: string[];
  /** Confidence score (0-100) */
  confidence: number;
  /** How domain name was determined */
  source: 'scc' | 'prefix' | 'core-entity' | 'filename';
}

/**
 * Result of relation graph analysis
 */
export interface RelationGraphResult {
  nodes: RelationNode[];
  clusters: ModelCluster[];
  /** Models that couldn't be confidently clustered */
  unclustered: string[];
}

// ============================================================================
// GRAPH BUILDING
// ============================================================================

/**
 * Build relation graph from parsed models
 */
export function buildRelationGraph(models: PrismaModel[]): Map<string, RelationNode> {
  const nodes = new Map<string, RelationNode>();

  // Initialize nodes
  for (const model of models) {
    nodes.set(model.name, {
      model: model.name,
      file: model.file,
      relations: model.relations,
      referencedBy: [],
      inDegree: 0,
      outDegree: model.relations.length,
    });
  }

  // Build referencedBy (incoming edges)
  for (const model of models) {
    for (const relation of model.relations) {
      const targetNode = nodes.get(relation);
      if (targetNode) {
        targetNode.referencedBy.push(model.name);
        targetNode.inDegree++;
      }
    }
  }

  return nodes;
}

// ============================================================================
// TARJAN SCC (adapted from safe-order.ts)
// ============================================================================

interface TarjanState {
  index: Map<string, number>;
  lowlink: Map<string, number>;
  onStack: Set<string>;
  stack: string[];
  sccs: string[][];
  currentIndex: number;
}

/**
 * Find strongly connected components using Tarjan's algorithm
 */
function findSCC(nodes: Map<string, RelationNode>): string[][] {
  const state: TarjanState = {
    index: new Map(),
    lowlink: new Map(),
    onStack: new Set(),
    stack: [],
    sccs: [],
    currentIndex: 0,
  };

  function strongConnect(nodeId: string): void {
    state.index.set(nodeId, state.currentIndex);
    state.lowlink.set(nodeId, state.currentIndex);
    state.currentIndex++;
    state.stack.push(nodeId);
    state.onStack.add(nodeId);

    const node = nodes.get(nodeId);
    const deps = node?.relations ?? [];

    for (const depId of deps) {
      if (!nodes.has(depId)) continue; // Skip external references

      if (!state.index.has(depId)) {
        strongConnect(depId);
        state.lowlink.set(nodeId, Math.min(state.lowlink.get(nodeId)!, state.lowlink.get(depId)!));
      } else if (state.onStack.has(depId)) {
        state.lowlink.set(nodeId, Math.min(state.lowlink.get(nodeId)!, state.index.get(depId)!));
      }
    }

    if (state.lowlink.get(nodeId) === state.index.get(nodeId)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = state.stack.pop()!;
        state.onStack.delete(w);
        scc.push(w);
      } while (w !== nodeId);
      state.sccs.push(scc);
    }
  }

  for (const nodeId of nodes.keys()) {
    if (!state.index.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  return state.sccs;
}

// ============================================================================
// CLUSTER NAMING
// ============================================================================

/**
 * Find common prefix among model names
 * Returns null if no clear common prefix (< 60% match)
 */
function findCommonPrefix(models: string[]): string | null {
  if (models.length < 2) return null;

  // Extract potential prefixes (CamelCase splitting)
  const prefixes = new Map<string, number>();

  for (const model of models) {
    // Split by CamelCase: BookingSlot -> ["Booking", "Slot"]
    const parts = model.split(/(?=[A-Z])/);
    if (parts.length >= 2) {
      const prefix = parts[0]!;
      if (prefix.length >= 3) {
        // Minimum 3 chars
        prefixes.set(prefix, (prefixes.get(prefix) ?? 0) + 1);
      }
    }
  }

  // Find prefix that matches >= 60% of models
  for (const [prefix, count] of prefixes) {
    const ratio = count / models.length;
    if (ratio >= 0.6) {
      return prefix;
    }
  }

  return null;
}

/**
 * Find core entity in cluster (highest inDegree)
 */
function findCoreEntity(models: string[], nodes: Map<string, RelationNode>): string | null {
  let maxInDegree = 0;
  let core: string | null = null;

  for (const model of models) {
    const node = nodes.get(model);
    if (node && node.inDegree > maxInDegree) {
      maxInDegree = node.inDegree;
      core = model;
    }
  }

  // Only return if inDegree is significant (at least 2 references)
  return maxInDegree >= 2 ? core : null;
}

/**
 * Infer domain name for a cluster
 * Returns name + confidence + source
 */
function inferClusterName(
  models: string[],
  nodes: Map<string, RelationNode>,
): { name: string; confidence: number; source: ModelCluster['source'] } {
  // Strategy 1: Common prefix (e.g., BookingSlot, BookingReminder → "Bookings")
  const prefix = findCommonPrefix(models);
  if (prefix) {
    return {
      name: prefix.endsWith('s') ? prefix : `${prefix}s`,
      confidence: 85,
      source: 'prefix',
    };
  }

  // Strategy 2: Core entity name (if cluster has clear center)
  const core = findCoreEntity(models, nodes);
  if (core && models.length >= 2) {
    return {
      name: core.endsWith('s') ? core : `${core}s`,
      confidence: 75,
      source: 'core-entity',
    };
  }

  // Strategy 3: Filename fallback (low confidence)
  const files = new Set(models.map((m) => nodes.get(m)?.file ?? ''));
  if (files.size === 1) {
    const file = [...files][0]!;
    const domain = file.replace(/\.prisma$/, '').replace(/^.*\//, '');
    if (domain && domain !== 'schema') {
      return {
        name: domain.charAt(0).toUpperCase() + domain.slice(1),
        confidence: 50,
        source: 'filename',
      };
    }
  }

  // No confident inference
  return { name: '', confidence: 0, source: 'filename' };
}

// ============================================================================
// MAIN ANALYSIS
// ============================================================================

/** Minimum confidence to accept a cluster (Google rule: skip uncertain) */
const MIN_CONFIDENCE = 60;

/** Minimum SCC size to consider as cluster (singletons go to unclustered) */
const MIN_CLUSTER_SIZE = 2;

/**
 * Analyze relation graph and detect model clusters
 *
 * Google rule: Better to skip than show false positives.
 * Only returns clusters with confidence >= 60%.
 */
export function analyzeRelationGraph(models: PrismaModel[]): RelationGraphResult {
  const nodes = buildRelationGraph(models);
  const sccs = findSCC(nodes);

  const clusters: ModelCluster[] = [];
  const unclustered: string[] = [];

  for (const scc of sccs) {
    // Skip tiny SCCs (singletons without strong connections)
    if (scc.length < MIN_CLUSTER_SIZE) {
      // Check if singleton has significant connections
      const node = nodes.get(scc[0]!);
      if (!node || (node.inDegree < 3 && node.outDegree < 3)) {
        unclustered.push(...scc);
        continue;
      }
    }

    // Try to name this cluster
    const { name, confidence, source } = inferClusterName(scc, nodes);

    // Apply Google rule: skip uncertain
    if (confidence < MIN_CONFIDENCE) {
      unclustered.push(...scc);
      continue;
    }

    const core = findCoreEntity(scc, nodes);

    clusters.push({
      name,
      core,
      models: scc.sort(),
      confidence,
      source,
    });
  }

  // Sort clusters by size (largest first)
  clusters.sort((a, b) => b.models.length - a.models.length);

  return {
    nodes: Array.from(nodes.values()),
    clusters,
    unclustered: unclustered.sort(),
  };
}

/**
 * Get domain for a model using smart detection with fallback
 *
 * Returns: { domain: string, confidence: number }
 */
export function getModelDomain(
  modelName: string,
  clusters: ModelCluster[],
  fallbackDomain: string,
): { domain: string; confidence: number } {
  // Check if model is in any cluster
  for (const cluster of clusters) {
    if (cluster.models.includes(modelName)) {
      return { domain: cluster.name, confidence: cluster.confidence };
    }
  }

  // Fallback to filename-based domain
  return { domain: fallbackDomain, confidence: 30 };
}
