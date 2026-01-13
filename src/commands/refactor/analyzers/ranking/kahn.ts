/**
 * @module commands/refactor/analyzers/ranking/kahn
 * @description Kahn's algorithm for topological sorting
 *
 * Returns modules in dependency order (dependencies before dependents).
 * For refactoring, we typically reverse this (dependents first, then dependencies).
 *
 * @see https://en.wikipedia.org/wiki/Topological_sorting#Kahn's_algorithm
 */

// ============================================================================
// KAHN'S TOPOLOGICAL SORT
// ============================================================================

/**
 * Topological sort using Kahn's algorithm
 *
 * Returns modules in dependency order (dependencies before dependents).
 * For refactoring, we reverse this (dependents first, then dependencies).
 *
 * @param dependencyGraph - Record<module, dependencies[]>
 * @param pageRankScores - Optional PageRank scores for secondary ordering
 * @returns Topologically sorted array of module paths
 */
export function kahnTopologicalSort(
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

/**
 * Alias for backwards compatibility
 * @deprecated Use kahnTopologicalSort instead
 */
export const topologicalSort = kahnTopologicalSort;
