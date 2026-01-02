/**
 * @module commands/audit/impact/types
 * @description Types for impact analysis in audit command
 *
 * Provides types for scoring issue impact based on:
 * - Downstream dependents (via PageRank)
 * - Bug history from git commits
 * - Change frequency (hot files)
 */

// ============================================================================
// RISK LEVELS
// ============================================================================

/**
 * Risk level based on combined impact factors
 *
 * - critical: >20 dependents OR top 5% by PageRank OR >3 bug-fix commits
 * - high: >10 dependents OR top 20% by PageRank OR >1 bug-fix commits
 * - medium: >5 dependents OR top 50% by PageRank
 * - low: everything else
 */
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

// ============================================================================
// IMPACT SCORE
// ============================================================================

/**
 * Impact score for a file or issue
 *
 * Combines multiple signals to assess the potential impact
 * of changes or issues in a file.
 */
export interface ImpactScore {
  /** Number of files that depend on this file */
  dependents: number;

  /** Number of bug-fix commits in the analysis period */
  bugHistory: number;

  /** Total commits in the analysis period (change frequency) */
  changeFrequency: number;

  /** PageRank score from dependency graph (0-1, higher = more central) */
  pageRank: number;

  /** Percentile rank based on PageRank (0-100) */
  percentile: number;

  /** Computed risk level based on all factors */
  riskLevel: RiskLevel;

  /** Top dependent files (optional, for enriched output) */
  dependentFiles?: string[];

  /** Human-readable reason for risk level (optional) */
  riskReason?: string;
}

// ============================================================================
// GIT HISTORY ANALYSIS
// ============================================================================

/**
 * Result of git history analysis for a file
 */
export interface GitHistoryAnalysis {
  /** File path */
  file: string;

  /** Total commits touching this file in the period */
  totalCommits: number;

  /** Commits with bug-fix indicators (fix, bug, hotfix, etc.) */
  bugFixCommits: number;

  /** Commits with feature indicators (feat, add, new, etc.) */
  featureCommits: number;

  /** Analysis period in days */
  periodDays: number;

  /** Change frequency percentile (0-100, higher = more changes) */
  changeRank: string;
}

// ============================================================================
// IMPACT ANALYSIS RESULT
// ============================================================================

/**
 * Complete impact analysis result for a file
 */
export interface FileImpactAnalysis {
  /** File path */
  file: string;

  /** Computed impact score */
  impact: ImpactScore;

  /** Git history analysis */
  gitHistory: GitHistoryAnalysis;

  /** Why this file has this risk level */
  reason: string;
}

/**
 * Impact analysis options
 */
export interface ImpactAnalysisOptions {
  /** Period in days for git history analysis (default: 30) */
  periodDays?: number;

  /** Number of top files to return for change frequency (default: 10) */
  topCount?: number;

  /** Project root for git operations */
  projectRoot: string;
}

/**
 * Batch impact analysis result for multiple files
 */
export interface BatchImpactAnalysis {
  /** Impact analysis for each file */
  files: Map<string, FileImpactAnalysis>;

  /** Files sorted by risk (critical first) */
  byRisk: FileImpactAnalysis[];

  /** Files in top 5% by change frequency */
  hotFiles: string[];

  /** Files with recent bug fixes */
  buggyFiles: string[];

  /** Analysis statistics */
  stats: {
    filesAnalyzed: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    totalBugFixes: number;
    totalChanges: number;
    durationMs: number;
  };
}
