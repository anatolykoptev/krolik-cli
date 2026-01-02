/**
 * @module commands/audit/impact
 * @description Impact analysis for audit command (Phase 3)
 *
 * Provides impact scoring for files and issues based on:
 * - PageRank centrality from dependency graph
 * - Bug-fix correlation from git history
 * - Change frequency (hot files)
 *
 * ## Usage
 *
 * ```ts
 * import {
 *   analyzeImpact,
 *   analyzeFileImpact,
 *   getFileImpactScore,
 * } from './impact';
 *
 * // Analyze impact for multiple files
 * const result = analyzeImpact(files, projectRoot, dependencyGraph);
 *
 * // Access critical files
 * for (const file of result.byRisk) {
 *   if (file.impact.riskLevel === 'critical') {
 *     console.log(`${file.file}: ${file.reason}`);
 *   }
 * }
 *
 * // Single file analysis
 * const analysis = analyzeFileImpact('src/core.ts', projectRoot, graph);
 * console.log(analysis.impact.riskLevel); // 'critical' | 'high' | 'medium' | 'low'
 * ```
 *
 * ## Risk Level Criteria
 *
 * - **critical**: >20 dependents OR top 5% centrality OR >3 bug-fix commits
 * - **high**: >10 dependents OR top 20% centrality OR >1 bug-fix commits
 * - **medium**: >5 dependents OR top 50% centrality
 * - **low**: everything else
 *
 * @see types.ts for type definitions
 * @see analyzer.ts for main analysis logic
 * @see git-history.ts for git operations
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  BatchImpactAnalysis,
  FileImpactAnalysis,
  GitHistoryAnalysis,
  ImpactAnalysisOptions,
  ImpactScore,
  RiskLevel,
} from './types';

// ============================================================================
// ANALYZER EXPORTS
// ============================================================================

export {
  analyzeFileImpact,
  analyzeImpact,
  buildImpactGraph,
  calculateRiskLevel,
  getFileImpactScore,
} from './analyzer';

// ============================================================================
// GIT HISTORY EXPORTS
// ============================================================================

export {
  analyzeFileHistory,
  analyzeFilesHistory,
  type CommitInfo,
  DEFAULT_PERIOD_DAYS,
  getAllCommits,
  getBuggyFiles,
  getFileCommits,
  getHotFiles,
  isBugFixCommit,
  isFeatureCommit,
} from './git-history';
