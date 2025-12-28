/**
 * @module commands/refactor/analyzers/ranking/safe-order
 * @description Safe refactoring order using topological sort
 *
 * Generates a safe order for refactoring modules based on dependency topology.
 * Uses Kahn's algorithm for topological sort and Tarjan's algorithm for SCC detection.
 *
 * Key principles:
 * - Leaf nodes (no dependents) → refactor first (safe, no impact)
 * - Core nodes (many dependents) → refactor last (high impact)
 * - Cycles → must be refactored together as atomic unit
 */

import type { CouplingMetrics, RefactoringPhase, SafeRefactoringOrder } from './types.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Threshold for "core" classification (percentile of afferent coupling) */
const CORE_THRESHOLD_PERCENTILE = 80;

/** Risk multiplier for cycles */
const CYCLE_RISK_MULTIPLIER = 1.5;

// ============================================================================
// STRONGLY CONNECTED COMPONENTS (Tarjan's Algorithm)
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
 *
 * SCCs represent groups of modules with circular dependencies
 * that must be refactored together.
 */
export function findStronglyConnectedComponents(
  dependencyGraph: Record<string, string[]>,
): string[][] {
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

    const deps = dependencyGraph[nodeId] ?? [];
    for (const depId of deps) {
      if (!state.index.has(depId)) {
        // Successor not yet visited
        strongConnect(depId);
        state.lowlink.set(nodeId, Math.min(state.lowlink.get(nodeId)!, state.lowlink.get(depId)!));
      } else if (state.onStack.has(depId)) {
        // Successor is on stack → part of current SCC
        state.lowlink.set(nodeId, Math.min(state.lowlink.get(nodeId)!, state.index.get(depId)!));
      }
    }

    // If node is root of SCC
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

  // Visit all nodes
  for (const nodeId of Object.keys(dependencyGraph)) {
    if (!state.index.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  return state.sccs;
}

// ============================================================================
// TOPOLOGICAL SORT (Kahn's Algorithm)
// ============================================================================

/**
 * Topological sort using Kahn's algorithm
 *
 * Returns modules in dependency order (dependencies before dependents)
 * For refactoring, we reverse this (dependents first, then dependencies)
 */
export function topologicalSort(
  dependencyGraph: Record<string, string[]>,
  pageRankScores?: Map<string, number>,
): string[] {
  // Calculate in-degrees
  const inDegree = new Map<string, number>();
  for (const node of Object.keys(dependencyGraph)) {
    if (!inDegree.has(node)) {
      inDegree.set(node, 0);
    }
    for (const dep of dependencyGraph[node] ?? []) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  // Find all nodes with no incoming edges (leaf nodes in dependency sense)
  const queue: string[] = [];
  for (const [node, degree] of inDegree) {
    if (degree === 0) {
      queue.push(node);
    }
  }

  const result: string[] = [];

  while (queue.length > 0) {
    // Sort queue by PageRank (lowest first for safe ordering)
    if (pageRankScores) {
      queue.sort((a, b) => {
        const scoreA = pageRankScores.get(a) ?? 0;
        const scoreB = pageRankScores.get(b) ?? 0;
        return scoreA - scoreB;
      });
    }

    const node = queue.shift()!;
    result.push(node);

    // Remove edges from this node
    for (const dep of dependencyGraph[node] ?? []) {
      const newDegree = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, newDegree);
      if (newDegree === 0) {
        queue.push(dep);
      }
    }
  }

  return result;
}

// ============================================================================
// NODE CLASSIFICATION
// ============================================================================

/**
 * Classify a node as leaf, intermediate, or core based on coupling
 */
export function classifyNode(
  node: string,
  couplingMetrics: CouplingMetrics[],
  pageRankScores: Map<string, number>,
): 'leaf' | 'intermediate' | 'core' {
  const coupling = couplingMetrics.find((c) => c.path === node);
  if (!coupling) return 'intermediate';

  const Ca = coupling.afferentCoupling;
  const pageRank = pageRankScores.get(node) ?? 0;

  // Calculate percentiles
  const allCa = couplingMetrics.map((c) => c.afferentCoupling);
  const allPageRank = Array.from(pageRankScores.values());

  const caPercentile = calculatePercentile(Ca, allCa);
  const prPercentile = calculatePercentile(pageRank, allPageRank);

  // Leaf: no dependents or very low PageRank
  if (Ca === 0 || (caPercentile < 20 && prPercentile < 20)) {
    return 'leaf';
  }

  // Core: high dependents or high PageRank
  if (caPercentile >= CORE_THRESHOLD_PERCENTILE || prPercentile >= CORE_THRESHOLD_PERCENTILE) {
    return 'core';
  }

  return 'intermediate';
}

function calculatePercentile(value: number, allValues: number[]): number {
  if (allValues.length === 0) return 0;
  const sorted = [...allValues].sort((a, b) => a - b);
  const rank = sorted.filter((v) => v < value).length;
  return Math.round((rank / sorted.length) * 100);
}

// ============================================================================
// RISK CALCULATION
// ============================================================================

/**
 * Calculate risk score for a phase
 */
function calculatePhaseRisk(
  modules: string[],
  couplingMetrics: CouplingMetrics[],
  pageRankScores: Map<string, number>,
  isCycle: boolean,
): number {
  if (modules.length === 0) return 0;

  let totalRisk = 0;
  for (const module of modules) {
    const coupling = couplingMetrics.find((c) => c.path === module);
    const Ca = coupling?.afferentCoupling ?? 0;
    const pageRank = pageRankScores.get(module) ?? 0;
    totalRisk += Ca * 10 + pageRank * 100;
  }

  const avgRisk = totalRisk / modules.length;
  return Math.round(avgRisk * (isCycle ? CYCLE_RISK_MULTIPLIER : 1));
}

/**
 * Convert numeric risk to level
 */
function getRiskLevel(riskScore: number): RefactoringPhase['riskLevel'] {
  if (riskScore >= 50) return 'critical';
  if (riskScore >= 30) return 'high';
  if (riskScore >= 10) return 'medium';
  return 'low';
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Generate safe refactoring order based on dependency topology
 *
 * Algorithm:
 * 1. Find strongly connected components (cycles)
 * 2. Build condensation graph (SCCs as nodes)
 * 3. Topological sort of condensation graph
 * 4. Group into phases by dependency level
 * 5. Calculate risk for each phase
 */
export function generateSafeRefactoringOrder(
  dependencyGraph: Record<string, string[]>,
  couplingMetrics: CouplingMetrics[],
  pageRankScores: Map<string, number>,
): SafeRefactoringOrder {
  const nodes = Object.keys(dependencyGraph);
  if (nodes.length === 0) {
    return {
      phases: [],
      totalModules: 0,
      estimatedRisk: 'low',
      cycles: [],
      leafNodes: [],
      coreNodes: [],
    };
  }

  // 1. Find SCCs (cycles)
  const sccs = findStronglyConnectedComponents(dependencyGraph);
  const cycles = sccs.filter((scc) => scc.length > 1);

  // 2. Classify nodes
  const leafNodes: string[] = [];
  const coreNodes: string[] = [];

  for (const node of nodes) {
    const classification = classifyNode(node, couplingMetrics, pageRankScores);
    if (classification === 'leaf') {
      leafNodes.push(node);
    } else if (classification === 'core') {
      coreNodes.push(node);
    }
  }

  // 3. Build condensation graph (treat each SCC as single node)
  const sccMap = new Map<string, number>(); // node → SCC index
  for (let i = 0; i < sccs.length; i++) {
    for (const node of sccs[i]!) {
      sccMap.set(node, i);
    }
  }

  const condensedGraph: Record<string, string[]> = {};
  for (let i = 0; i < sccs.length; i++) {
    condensedGraph[String(i)] = [];
  }

  for (const [node, deps] of Object.entries(dependencyGraph)) {
    const nodeScc = sccMap.get(node);
    if (nodeScc === undefined) continue;

    for (const dep of deps) {
      const depScc = sccMap.get(dep);
      if (depScc !== undefined && depScc !== nodeScc) {
        const existing = condensedGraph[String(nodeScc)]!;
        if (!existing.includes(String(depScc))) {
          existing.push(String(depScc));
        }
      }
    }
  }

  // 4. Topological sort of condensed graph (used for validation)
  // Note: We use BFS-based level grouping below for phase generation
  void topologicalSort(condensedGraph);

  // 5. Generate phases
  const phases: RefactoringPhase[] = [];
  let phaseOrder = 1;

  // Group SCCs into phases based on dependency levels
  const processed = new Set<number>();
  const levels: number[][] = [];

  // BFS to find levels
  const inDegree = new Map<number, number>();
  for (let i = 0; i < sccs.length; i++) {
    inDegree.set(i, 0);
  }
  for (const [, deps] of Object.entries(condensedGraph)) {
    for (const dep of deps) {
      inDegree.set(Number(dep), (inDegree.get(Number(dep)) ?? 0) + 1);
    }
  }

  let currentLevel: number[] = [];
  for (const [sccIdx, degree] of inDegree) {
    if (degree === 0) {
      currentLevel.push(sccIdx);
    }
  }

  while (currentLevel.length > 0) {
    levels.push(currentLevel);
    const nextLevel: number[] = [];

    for (const sccIdx of currentLevel) {
      processed.add(sccIdx);
      for (const depStr of condensedGraph[String(sccIdx)] ?? []) {
        const depIdx = Number(depStr);
        const newDegree = (inDegree.get(depIdx) ?? 1) - 1;
        inDegree.set(depIdx, newDegree);
        if (newDegree === 0 && !processed.has(depIdx)) {
          nextLevel.push(depIdx);
        }
      }
    }

    currentLevel = nextLevel;
  }

  // Convert levels to phases
  for (const level of levels) {
    for (const sccIdx of level) {
      const scc = sccs[sccIdx]!;
      const isCycle = scc.length > 1;

      const riskScore = calculatePhaseRisk(scc, couplingMetrics, pageRankScores, isCycle);
      const category = isCycle
        ? 'cycle'
        : scc.every((n) => leafNodes.includes(n))
          ? 'leaf'
          : scc.every((n) => coreNodes.includes(n))
            ? 'core'
            : 'intermediate';

      phases.push({
        order: phaseOrder++,
        modules: scc,
        canParallelize: !isCycle && scc.length > 1,
        riskLevel: getRiskLevel(riskScore),
        riskScore,
        prerequisites: [], // Will be filled below
        category,
      });
    }
  }

  // Fill prerequisites
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i]!;
    const phaseSccIndices = phase.modules.map((m) => sccMap.get(m)!);

    for (let j = 0; j < i; j++) {
      const prevPhase = phases[j]!;
      const prevSccIndices = prevPhase.modules.map((m) => sccMap.get(m)!);

      // Check if any module in this phase depends on previous phase
      const hasDepFromPrev = phaseSccIndices.some((sccIdx) =>
        condensedGraph[String(sccIdx)]?.some((depStr) => prevSccIndices.includes(Number(depStr))),
      );

      if (hasDepFromPrev) {
        phase.prerequisites.push(prevPhase.order);
      }
    }
  }

  // Calculate overall risk
  const maxRisk = Math.max(...phases.map((p) => p.riskScore), 0);
  const estimatedRisk: SafeRefactoringOrder['estimatedRisk'] =
    maxRisk >= 50 ? 'critical' : maxRisk >= 30 ? 'high' : maxRisk >= 10 ? 'medium' : 'low';

  return {
    phases,
    totalModules: nodes.length,
    estimatedRisk,
    cycles,
    leafNodes,
    coreNodes,
  };
}
