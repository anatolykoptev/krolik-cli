/**
 * @module commands/refactor/analyzers/core/duplicates/strategies/semantic-clones
 * @description Semantic clone detection strategy using Toma approach
 *
 * Detects Type-3 and Type-4 code clones by:
 * 1. Converting code to abstract type sequences
 * 2. Grouping by sequence hash (exact semantic matches)
 * 3. Computing multi-metric similarity for fuzzy matches
 */

import { abstractTokens, MIN_SEQUENCE_LENGTH, quickSimilarity } from '../../../../../../lib/@toma';
import type { DuplicateInfo, FunctionSignature } from '../../../../core/types';
import { areIntentionalVerbNounPatterns, haveDifferentArchPatterns } from './filters';
import {
  deduplicateLocations,
  isLargeEnoughForDuplication,
  sortNamesByExportStatus,
} from './helpers';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Minimum combined similarity score to report as semantic clone
 * Very high threshold (0.92) because abstract tokens collapse too much detail
 */
const MIN_SEMANTIC_SIMILARITY = 0.92;

/**
 * Maximum cluster size to report
 * Larger clusters are usually false positives from transitive closure
 */
const MAX_CLUSTER_SIZE = 3;

/**
 * Maximum number of functions to compare in Phase 2 (fuzzy matching)
 * O(n²) complexity, so we limit to avoid hanging on large codebases
 */
const MAX_FUZZY_CANDIDATES = 100;

/**
 * Regex pattern to detect simple wrapper functions
 * The normalizedBody includes full function signature, so we match:
 * function name(...) { return func(args); }
 * or arrow: (...) => func(args)
 */
const WRAPPER_PATTERN = /{\s*return\s+[\w.]+\s*\([^)]*\)\s*;?\s*}\s*$/;

/**
 * Check if function body is a simple wrapper (return otherFunc(args))
 * These are false positives for semantic clone detection
 */
function isWrapperFunction(normalizedBody: string): boolean {
  return WRAPPER_PATTERN.test(normalizedBody);
}

// ============================================================================
// SEMANTIC CLONE DETECTION
// ============================================================================

/**
 * Options for semantic clone detection
 */
export interface SemanticCloneOptions {
  /**
   * Enable Phase 2 fuzzy matching (O(n²), slow)
   * Default: false - only hash-based matching (O(n), fast)
   */
  enableFuzzyMatching?: boolean;
}

/**
 * Find semantic clones using abstract type sequences
 *
 * Two-phase approach:
 * 1. Hash-based: Group functions with identical abstract sequences (O(n), always runs)
 * 2. Similarity-based: Find fuzzy matches above threshold (O(n²), optional)
 *
 * @param allFunctions - All extracted functions
 * @param reportedLocations - Set of already reported locations
 * @param options - Detection options
 * @returns Detected semantic clone duplicates
 */
export function findSemanticClones(
  allFunctions: FunctionSignature[],
  reportedLocations: Set<string>,
  options: SemanticCloneOptions = {},
): DuplicateInfo[] {
  const { enableFuzzyMatching = false } = options;
  const duplicates: DuplicateInfo[] = [];

  // Filter functions that are large enough, not wrappers, and not already reported
  const candidates = allFunctions.filter((func) => {
    if (!isLargeEnoughForDuplication(func)) return false;

    // Skip wrapper functions - they have identical structure but different purposes
    if (isWrapperFunction(func.normalizedBody)) return false;

    const locKey = `${func.file}:${func.line}`;
    if (reportedLocations.has(locKey)) return false;

    return true;
  });

  if (candidates.length < 2) return duplicates;

  // Generate abstract sequences for all candidates
  const funcWithSequences = candidates.map((func) => {
    const result = abstractTokens(func.normalizedBody);
    return {
      func,
      sequence: result.typeSequence,
      hash: result.sequenceHash,
    };
  });

  // Filter by minimum sequence length
  const validFuncs = funcWithSequences.filter((f) => f.sequence.length >= MIN_SEQUENCE_LENGTH);

  if (validFuncs.length < 2) return duplicates;

  // Phase 1: Hash-based exact matching
  const byHash = new Map<string, typeof validFuncs>();

  for (const item of validFuncs) {
    const existing = byHash.get(item.hash) ?? [];
    existing.push(item);
    byHash.set(item.hash, existing);
  }

  // Report exact hash matches
  for (const [, group] of byHash) {
    if (group.length < 2) continue;

    // Skip oversized clusters - too many matches means the pattern is too generic
    if (group.length > MAX_CLUSTER_SIZE) continue;

    const funcs = group.map((g) => g.func);

    // Deduplicate and check file diversity
    const { locations, uniqueFileCount } = deduplicateLocations(funcs);
    if (uniqueFileCount < 2 || locations.length < 2) continue;

    const uniqueNames = new Set(funcs.map((f) => f.name));

    // Skip if same name (already caught by name-based strategy)
    if (uniqueNames.size < 2) continue;

    // Skip intentional patterns
    if (areIntentionalVerbNounPatterns([...uniqueNames])) continue;
    if (haveDifferentArchPatterns(funcs)) continue;

    const sortedNames = sortNamesByExportStatus(uniqueNames, funcs);

    // Mark as reported
    for (const loc of locations) {
      reportedLocations.add(`${loc.file}:${loc.line}`);
    }

    duplicates.push({
      name: `[semantic clone] ${sortedNames.join(' / ')}`,
      locations,
      similarity: 1.0, // Exact semantic match
      recommendation: 'merge',
    });
  }

  // Phase 2: Fuzzy similarity matching (optional, O(n²))
  // Skip if not enabled - returns only exact hash matches from Phase 1
  if (!enableFuzzyMatching) {
    return duplicates;
  }

  // Only compare functions that weren't matched in Phase 1
  let unmatched = validFuncs.filter((f) => {
    const locKey = `${f.func.file}:${f.func.line}`;
    return !reportedLocations.has(locKey);
  });

  if (unmatched.length < 2) return duplicates;

  // Limit candidates to avoid O(n²) explosion on large codebases
  if (unmatched.length > MAX_FUZZY_CANDIDATES) {
    // Sort by sequence length (longer = more complex = more likely to be meaningful duplicates)
    unmatched = unmatched
      .sort((a, b) => b.sequence.length - a.sequence.length)
      .slice(0, MAX_FUZZY_CANDIDATES);
  }

  // Build similarity pairs
  const pairs: Array<{
    func1: FunctionSignature;
    func2: FunctionSignature;
    similarity: number;
  }> = [];

  for (let i = 0; i < unmatched.length - 1; i++) {
    const item1 = unmatched[i];
    if (!item1) continue;

    for (let j = i + 1; j < unmatched.length; j++) {
      const item2 = unmatched[j];
      if (!item2) continue;

      // Skip same file (handled by other strategies)
      if (item1.func.file === item2.func.file) continue;

      // Compute quick similarity
      const sim = quickSimilarity(item1.sequence, item2.sequence, MIN_SEMANTIC_SIMILARITY);

      if (sim >= MIN_SEMANTIC_SIMILARITY) {
        pairs.push({
          func1: item1.func,
          func2: item2.func,
          similarity: sim,
        });
      }
    }
  }

  // Group overlapping pairs into clusters
  const clusters = clusterPairs(pairs);

  for (const cluster of clusters) {
    const funcs = cluster.funcs;
    const avgSimilarity = cluster.avgSimilarity;

    // Skip oversized clusters (likely false positives from transitive closure)
    if (funcs.length > MAX_CLUSTER_SIZE) continue;

    // Deduplicate locations
    const { locations, uniqueFileCount } = deduplicateLocations(funcs);
    if (uniqueFileCount < 2 || locations.length < 2) continue;

    const uniqueNames = new Set(funcs.map((f) => f.name));

    // Skip if same name
    if (uniqueNames.size < 2) continue;

    // Skip intentional patterns
    if (areIntentionalVerbNounPatterns([...uniqueNames])) continue;
    if (haveDifferentArchPatterns(funcs)) continue;

    const sortedNames = sortNamesByExportStatus(uniqueNames, funcs);

    // Mark as reported
    for (const loc of locations) {
      reportedLocations.add(`${loc.file}:${loc.line}`);
    }

    duplicates.push({
      name: `[semantic clone] ${sortedNames.join(' / ')}`,
      locations,
      similarity: avgSimilarity,
      recommendation: avgSimilarity >= 0.9 ? 'merge' : 'rename',
    });
  }

  return duplicates;
}

// ============================================================================
// CLUSTERING
// ============================================================================

interface Cluster {
  funcs: FunctionSignature[];
  avgSimilarity: number;
}

/**
 * Cluster overlapping pairs using union-find
 */
function clusterPairs(
  pairs: Array<{ func1: FunctionSignature; func2: FunctionSignature; similarity: number }>,
): Cluster[] {
  if (pairs.length === 0) return [];

  // Build union-find structure
  const parent = new Map<string, string>();
  const funcMap = new Map<string, FunctionSignature>();

  const getKey = (f: FunctionSignature) => `${f.file}:${f.line}`;

  const find = (key: string): string => {
    if (!parent.has(key)) {
      parent.set(key, key);
      return key;
    }
    const p = parent.get(key)!;
    if (p === key) return key;
    const root = find(p);
    parent.set(key, root); // Path compression
    return root;
  };

  const union = (key1: string, key2: string): void => {
    const root1 = find(key1);
    const root2 = find(key2);
    if (root1 !== root2) {
      parent.set(root2, root1);
    }
  };

  // Register all functions and union pairs
  for (const pair of pairs) {
    const key1 = getKey(pair.func1);
    const key2 = getKey(pair.func2);

    funcMap.set(key1, pair.func1);
    funcMap.set(key2, pair.func2);

    union(key1, key2);
  }

  // Group by root
  const groups = new Map<string, { funcs: FunctionSignature[]; similarities: number[] }>();

  for (const pair of pairs) {
    const key1 = getKey(pair.func1);
    const root = find(key1);

    if (!groups.has(root)) {
      groups.set(root, { funcs: [], similarities: [] });
    }

    const group = groups.get(root)!;
    group.similarities.push(pair.similarity);

    // Add functions if not already in group
    const func1Key = getKey(pair.func1);
    const func2Key = getKey(pair.func2);

    if (!group.funcs.some((f) => getKey(f) === func1Key)) {
      group.funcs.push(pair.func1);
    }
    if (!group.funcs.some((f) => getKey(f) === func2Key)) {
      group.funcs.push(pair.func2);
    }
  }

  // Convert to clusters
  const clusters: Cluster[] = [];

  for (const [, group] of groups) {
    if (group.funcs.length < 2) continue;

    const avgSimilarity = group.similarities.reduce((a, b) => a + b, 0) / group.similarities.length;

    clusters.push({
      funcs: group.funcs,
      avgSimilarity,
    });
  }

  return clusters;
}
