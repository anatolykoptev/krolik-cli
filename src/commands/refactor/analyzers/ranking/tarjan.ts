/**
 * @module commands/refactor/analyzers/ranking/tarjan
 * @description Tarjan's algorithm for finding Strongly Connected Components (SCC)
 *
 * SCCs represent groups of modules with circular dependencies
 * that must be refactored together as atomic units.
 *
 * @see https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm
 */

// ============================================================================
// TYPES
// ============================================================================

interface TarjanState {
  index: Map<string, number>;
  lowlink: Map<string, number>;
  onStack: Set<string>;
  stack: string[];
  sccs: string[][];
  currentIndex: number;
}

// ============================================================================
// TARJAN'S SCC ALGORITHM
// ============================================================================

/**
 * Find strongly connected components using Tarjan's algorithm
 *
 * SCCs represent groups of modules with circular dependencies
 * that must be refactored together.
 *
 * @param dependencyGraph - Record<module, dependencies[]>
 * @returns Array of SCCs (each SCC is an array of module paths)
 */
export function tarjanSCC(dependencyGraph: Record<string, string[]>): string[][] {
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
        // Successor is on stack - part of current SCC
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

/**
 * Alias for backwards compatibility
 * @deprecated Use tarjanSCC instead
 */
export const findStronglyConnectedComponents = tarjanSCC;
