/**
 * @module commands/refactor/analyzers/ranking/safe-order
 * @description Safe refactoring order using topological sort
 *
 * Generates a safe order for refactoring modules based on dependency topology.
 * Uses Kahn's algorithm for topological sort and Tarjan's algorithm for SCC detection.
 *
 * Key principles:
 * - Leaf nodes (no dependents) -> refactor first (safe, no impact)
 * - Core nodes (many dependents) -> refactor last (high impact)
 * - Cycles -> must be refactored together as atomic unit
 */

import {
  buildCouplingMap,
  calculatePhaseRisk,
  classifyNode,
  classifyNodeWithMaps,
  getRiskLevel,
} from './classification.js';
import { kahnTopologicalSort, topologicalSort } from './kahn.js';
import { findStronglyConnectedComponents, tarjanSCC } from './tarjan.js';
import type { CouplingMetrics, RefactoringPhase, SafeRefactoringOrder } from './types.js';

// Re-export for backwards compatibility
export { findStronglyConnectedComponents, topologicalSort, classifyNode };

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

  // Pre-build lookup map for O(1) coupling access (avoids O(n^2) from find() in loops)
  const couplingMap = buildCouplingMap(couplingMetrics);

  // Pre-compute percentile arrays once (used by classifyNode)
  const allCa = couplingMetrics.map((c) => c.afferentCoupling);
  const allPageRank = Array.from(pageRankScores.values());

  // 1. Find SCCs (cycles)
  const sccs = tarjanSCC(dependencyGraph);
  const cycles = sccs.filter((scc) => scc.length > 1);

  // 2. Classify nodes using pre-built maps (O(n) instead of O(n^2))
  const leafNodes: string[] = [];
  const coreNodes: string[] = [];

  for (const node of nodes) {
    const classification = classifyNodeWithMaps(
      node,
      couplingMap,
      pageRankScores,
      allCa,
      allPageRank,
    );
    if (classification === 'leaf') {
      leafNodes.push(node);
    } else if (classification === 'core') {
      coreNodes.push(node);
    }
  }

  // 3. Build condensation graph (treat each SCC as single node)
  const sccMap = new Map<string, number>(); // node -> SCC index
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
  void kahnTopologicalSort(condensedGraph);

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

      const riskScore = calculatePhaseRisk(scc, couplingMap, pageRankScores, isCycle);
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
