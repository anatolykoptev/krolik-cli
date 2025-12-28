/**
 * @module commands/refactor/analyzers/ranking/types
 * @description Types for PageRank-based dependency analysis
 *
 * Provides types for:
 * - Dependency hotspots (high PageRank + high Ca)
 * - Coupling metrics (Ca, Ce, Instability)
 * - Safe refactoring order (topological sort)
 * - Change impact prediction
 */

// ============================================================================
// COUPLING METRICS
// ============================================================================

/**
 * Robert C. Martin's coupling metrics for a module
 *
 * @see https://en.wikipedia.org/wiki/Software_package_metrics
 */
export interface CouplingMetrics {
  /** Module path */
  path: string;

  /** Afferent Coupling - number of modules that depend on this one */
  afferentCoupling: number;

  /** Efferent Coupling - number of modules this one depends on */
  efferentCoupling: number;

  /**
   * Instability = Ce / (Ce + Ca)
   * Range: 0 (maximally stable) to 1 (maximally unstable)
   *
   * - I=0: Fully stable, hard to change (many dependents, no dependencies)
   * - I=1: Fully unstable, easy to change (no dependents, many dependencies)
   */
  instability: number;

  /**
   * Risk score = PageRank × Ca
   * High PageRank + High Ca = Critical module (many things depend on central node)
   */
  riskScore: number;
}

// ============================================================================
// DEPENDENCY HOTSPOTS
// ============================================================================

/**
 * Dependency hotspot - a highly central module that affects many others
 */
export interface DependencyHotspot {
  /** Module path */
  path: string;

  /** PageRank score (0-1, higher = more central) */
  pageRank: number;

  /** Percentile rank (0-100, higher = top of distribution) */
  percentile: number;

  /** Number of modules that depend on this one */
  dependentCount: number;

  /** Number of modules this one depends on */
  dependencyCount: number;

  /** Risk level based on centrality + coupling */
  riskLevel: 'critical' | 'high' | 'medium' | 'low';

  /** Coupling metrics */
  coupling: CouplingMetrics;

  /** Why this is a hotspot */
  reason: string;
}

// ============================================================================
// SAFE REFACTORING ORDER
// ============================================================================

/**
 * A phase in the safe refactoring plan
 */
export interface RefactoringPhase {
  /** Phase order (1 = first to refactor) */
  order: number;

  /** Modules to refactor in this phase */
  modules: string[];

  /** Whether modules in this phase can be refactored in parallel */
  canParallelize: boolean;

  /** Risk level for this phase */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';

  /** Numeric risk score (0-100) */
  riskScore: number;

  /** Prerequisites - phases that must complete before this one */
  prerequisites: number[];

  /** Category of modules in this phase */
  category: 'leaf' | 'intermediate' | 'core' | 'cycle';
}

/**
 * Complete safe refactoring order plan
 */
export interface SafeRefactoringOrder {
  /** Ordered phases for refactoring */
  phases: RefactoringPhase[];

  /** Total modules in plan */
  totalModules: number;

  /** Overall estimated risk */
  estimatedRisk: 'low' | 'medium' | 'high' | 'critical';

  /** Detected circular dependencies (must be refactored together) */
  cycles: string[][];

  /** Leaf nodes (safe to refactor first) */
  leafNodes: string[];

  /** Core nodes (refactor last, highest impact) */
  coreNodes: string[];
}

// ============================================================================
// RANKING ANALYSIS RESULT
// ============================================================================

/**
 * Complete ranking analysis result for refactor command
 */
export interface RankingAnalysis {
  /** PageRank scores for all modules */
  pageRankScores: Map<string, number>;

  /** Dependency hotspots (top N by PageRank) */
  hotspots: DependencyHotspot[];

  /** Coupling metrics for all modules */
  couplingMetrics: CouplingMetrics[];

  /** Safe refactoring order */
  safeOrder: SafeRefactoringOrder;

  /** Stats about the analysis */
  stats: RankingStats;
}

/**
 * Statistics about the ranking analysis
 */
export interface RankingStats {
  /** Number of nodes (modules) analyzed */
  nodeCount: number;

  /** Number of edges (dependencies) */
  edgeCount: number;

  /** PageRank iterations performed */
  iterations: number;

  /** Whether PageRank converged */
  converged: boolean;

  /** Analysis duration in ms */
  durationMs: number;

  /** Number of cycles detected */
  cycleCount: number;
}

// ============================================================================
// PRIORITY ENRICHMENT
// ============================================================================

/**
 * PageRank-based priority adjustment for recommendations
 */
export interface PriorityEnrichment {
  /** Original priority from sequential assignment */
  originalPriority: number;

  /** PageRank-based priority adjustment */
  pageRankBoost: number;

  /** Coupling-based priority adjustment */
  couplingBoost: number;

  /** Final computed priority */
  finalPriority: number;

  /** Reason for priority change */
  reason: string;
}
