/**
 * @module commands/fix/reporter/types
 * @description Types for AI Report Generator
 */

import type { ConfidenceScore, GoogleSeverity, Priority } from '@/types/severity';
import type { ImpactScore } from '../../commands/audit/impact';
import type { Suggestion } from '../../commands/audit/suggestions';
import type { FixDifficulty, QualityCategory, QualityIssue } from '../../commands/fix/core';
import type { GitContext, IssueCodeContext } from '../@krolik/enrichment';

// ============================================================================
// CONTENT PROVIDER
// ============================================================================

/**
 * Function to retrieve file content on demand
 */
export type ContentProvider = (path: string) => string | undefined;

// ============================================================================
// EFFORT ESTIMATION
// ============================================================================

/**
 * Effort level for fixing an issue
 */
export type EffortLevel = 'trivial' | 'small' | 'medium' | 'large' | 'complex';

/**
 * Effort estimation with reasoning
 */
export interface EffortEstimate {
  level: EffortLevel;
  /** Estimated minutes to fix */
  minutes: number;
  /** Human-readable time (e.g., "5 min", "30 min", "2 hours") */
  timeLabel: string;
  /** Why this effort level was assigned */
  reason: string;
}

/**
 * Effort thresholds in minutes
 */
export const EFFORT_THRESHOLDS: Record<EffortLevel, number> = {
  trivial: 5,
  small: 15,
  medium: 30,
  large: 60,
  complex: 120,
};

// ============================================================================
// ISSUE GROUPING
// ============================================================================

/**
 * Priority level for issue groups (alias for shared Priority type)
 */
export type PriorityLevel = Priority;

/**
 * An issue enriched with effort and priority
 */
export interface EnrichedIssue {
  issue: QualityIssue;
  effort: EffortEstimate;
  difficulty: FixDifficulty;
  priority: PriorityLevel;
  /** Whether this can be auto-fixed */
  autoFixable: boolean;
  /** Fix suggestion if available */
  fixSuggestion?: string;
  /** Context-aware code suggestion with before/after and confidence */
  suggestion?: Suggestion;
  /** Impact score based on dependency analysis and git history */
  impact?: ImpactScore;
  /** Git context for high-complexity or critical issues */
  gitContext?: GitContext;
  /** Cyclomatic complexity if known (from parent function) */
  complexity?: number;
  /** Code context with snippet and complexity breakdown */
  codeContext?: IssueCodeContext;

  // ============================================================================
  // GOOGLE-STYLE FIELDS (Phase 1)
  // ============================================================================

  /**
   * Google-style severity level
   * @see https://abseil.io/resources/swe-book/html/ch09.html
   */
  severity?: GoogleSeverity;

  /**
   * Confidence score for this issue detection
   * Google principle: Zero False Positives > High Recall
   */
  confidence?: ConfidenceScore;
}

/**
 * Group of related issues
 */
export interface IssueGroup {
  id: string;
  title: string;
  description: string;
  priority: PriorityLevel;
  category: QualityCategory | 'mixed';
  /** Total effort for all issues in group */
  totalEffort: EffortEstimate;
  /** Number of issues */
  count: number;
  /** Auto-fixable count */
  autoFixableCount: number;
  /** Issues in this group */
  issues: EnrichedIssue[];
}

// ============================================================================
// ISSUE PATTERN GROUPING (Smart Audit)
// ============================================================================

/**
 * Pattern identifiers for batch operations
 */
export type IssuePatternId =
  | 'any-usage'
  | 'console-log'
  | 'debugger'
  | 'alert'
  | 'ts-ignore'
  | 'ts-nocheck'
  | 'high-complexity'
  | 'missing-return-type'
  | 'hardcoded-url'
  | 'hardcoded-number'
  | 'hardcoded-string'
  | 'path-traversal'
  | 'command-injection'
  | 'i18n-hardcoded'
  | 'other';

/**
 * Batch fix information for a pattern
 */
export interface BatchFixInfo {
  /** Whether a batch fix is available */
  available: boolean;
  /** CLI command to run batch fix */
  command?: string;
  /** Number of files affected */
  filesAffected: number;
  /** Number of issues that can be auto-fixed */
  autoFixable: number;
  /** Number of issues that require manual intervention */
  manualRequired: number;
}

/**
 * File-level issue summary within a pattern
 */
export interface PatternFileInfo {
  /** Relative file path */
  path: string;
  /** Number of issues in this file for this pattern */
  count: number;
  /** Number of auto-fixable issues */
  auto: number;
}

/**
 * A pattern-based grouping of issues for smart audit output
 *
 * Groups issues by their underlying pattern (e.g., all `any` usages)
 * to enable batch operations and reduce noise in output.
 */
export interface IssuePattern {
  /** Issue category (e.g., 'type-safety', 'lint') */
  category: QualityCategory;
  /** Pattern identifier (e.g., 'any-usage', 'console-log') */
  pattern: IssuePatternId;
  /** Human-readable pattern name */
  patternName: string;
  /** All issues matching this pattern */
  issues: EnrichedIssue[];
  /** Batch fix information */
  batchFix: BatchFixInfo;
  /** Issues grouped by file */
  byFile: PatternFileInfo[];
}

// ============================================================================
// AI REPORT
// ============================================================================

/**
 * Summary statistics for the report
 */
export interface ReportSummary {
  totalIssues: number;
  autoFixableIssues: number;
  manualIssues: number;
  /** Estimated total time in minutes */
  totalEffortMinutes: number;
  /** Human-readable total effort */
  totalEffortLabel: string;
  /** Breakdown by priority */
  byPriority: Record<PriorityLevel, number>;
  /** Breakdown by category */
  byCategory: Record<string, number>;
  /** Breakdown by effort */
  byEffort: Record<EffortLevel, number>;
}

/**
 * Project context for the report
 */
export interface ReportContext {
  projectRoot: string;
  gitBranch?: string | undefined;
  gitStatus?:
    | {
        modified: number;
        untracked: number;
        staged: number;
      }
    | undefined;
  /** Detected tech stack */
  techStack?: string[] | undefined;
  /** Detected domains */
  domains?: string[] | undefined;
}

/**
 * Action step for AI to execute
 */
export interface ActionStep {
  id: string;
  action: 'fix' | 'refactor' | 'review' | 'skip';
  file: string;
  line?: number | undefined;
  description: string;
  effort: EffortEstimate;
  /** Priority level (for conditional rendering) */
  priority: PriorityLevel;
  /** Issue category (for snippet sizing) */
  category: string;
  /** Dependencies (other step IDs that must be done first) */
  dependsOn?: string[] | undefined;
  /** Code snippet showing the problematic code */
  snippet?: string | undefined;
  /** Code change suggestion */
  suggestion?:
    | {
        before?: string | undefined;
        after: string;
        reason: string;
        /** Type inference context (for type-safety issues) */
        typeContext?:
          | {
              current: string;
              inferredType: string;
              confidence: number;
              evidence: Array<{
                type: string;
                description: string;
                line?: number | undefined;
              }>;
              suggestedFix: string;
            }
          | undefined;
      }
    | undefined;
  /** Code context with snippet and complexity breakdown (for CRITICAL/HIGH) */
  codeContext?: IssueCodeContext | undefined;
}

/**
 * File context for AI understanding
 */
export interface FileContext {
  path: string;
  purpose: string;
  type: 'component' | 'hook' | 'util' | 'router' | 'schema' | 'test' | 'config' | 'unknown';
  metrics: {
    lines: number;
    functions: number;
    avgComplexity: number;
  };
  exports: string[];
  imports: string[];
}

/**
 * Git information for AI report
 */
export interface GitInfo {
  branch: string;
  modified: number;
  untracked: number;
  staged: number;
  recentCommits: Array<{
    hash: string;
    message: string;
    relativeDate: string;
  }>;
}

/**
 * AI rules file reference
 */
export interface AIRuleFile {
  path: string;
  scope: 'root' | 'package';
}

/**
 * Next action recommendation
 */
export interface NextActionItem {
  priority: 'critical' | 'high' | 'medium' | 'low';
  action: string;
  reason?: string;
}

/**
 * Complete AI Report structure
 */
export interface AIReport {
  meta: {
    version: '1.0';
    generatedAt: string;
    generatedBy: 'krolik-cli';
  };
  context: ReportContext;
  summary: ReportSummary;
  /** Issues grouped by priority and category */
  groups: IssueGroup[];
  /** Recommended action steps for AI */
  actionPlan: ActionStep[];
  /** Quick wins (trivial fixes that can be done first) */
  quickWins: EnrichedIssue[];
  /** Files sorted by issue count (hotspots) */
  hotspots: Array<{
    file: string;
    issueCount: number;
    priority: PriorityLevel;
  }>;
  /** File contexts for AI understanding */
  fileContexts: FileContext[];
  /** Git information */
  git?: GitInfo;
  /** AI rules files to read */
  aiRules?: AIRuleFile[];
  /** Next action to take */
  nextAction?: NextActionItem;
  /** Anti-patterns to avoid */
  doNot?: string[];
  /** Number of i18n issues excluded from main report (shown separately) */
  excludedI18nCount?: number;
  /** Backwards-compat shim files that should be deleted */
  backwardsCompatFiles?: BackwardsCompatSummary[];
  /** Ranking analysis (hotspots, safe refactoring order) */
  ranking?: RankingSummary;
  /** Top recommendations from refactor analysis */
  recommendations?: RecommendationSummary[];
  /** Duplicate functions summary */
  duplicates?: DuplicateSummary;
  /** Issues grouped by pattern for smart audit output */
  issuePatterns?: IssuePattern[];
  /** Clustered issues (3+ same category in same file) */
  issueClusters?: IssueCluster[];
  /** Readability score (Chromium Tricorder-style) */
  readability?: ReadabilityScoreSummary;
  /** Code style recommendations (simplify, typescript, imports, etc.) */
  codeStyleRecommendations?: CodeStyleRecommendation[];
}

// ============================================================================
// CODE STYLE RECOMMENDATIONS
// ============================================================================

/**
 * Code style recommendation (simplify, typescript, imports, etc.)
 * From quality analysis (Google/Airbnb style guides)
 */
export interface CodeStyleRecommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: 'suggestion' | 'recommendation' | 'best-practice';
  file: string;
  line?: number;
  snippet?: string;
  count: number;
  /** Suggested fix (before/after) */
  fix?: {
    before: string;
    after: string;
  };
}

// ============================================================================
// READABILITY SCORE SUMMARY
// ============================================================================

/**
 * Readability score summary for report
 * Based on Chromium Tricorder analysis
 */
export interface ReadabilityScoreSummary {
  /** Overall score (0-100) */
  overall: number;
  /** Letter grade (A-F) */
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  /** Naming quality score */
  naming: number;
  /** Code structure score */
  structure: number;
  /** Documentation coverage score */
  comments: number;
  /** Cognitive complexity score (inverse - higher = simpler) */
  cognitive: number;
  /** Number of readability issues found */
  issueCount: number;
}

// ============================================================================
// BACKWARDS-COMPAT SUMMARY
// ============================================================================

/**
 * Backwards-compat shim file summary
 */
export interface BackwardsCompatSummary {
  /** File path */
  path: string;
  /** Confidence level (50-100) */
  confidence: number;
  /** Detection reason */
  reason: string;
  /** Where the code moved to */
  movedTo?: string;
  /** Suggested action */
  suggestion: string;
}

// ============================================================================
// RECOMMENDATION SUMMARY
// ============================================================================

/**
 * Simplified recommendation for audit report
 */
export interface RecommendationSummary {
  priority: number;
  category: 'architecture' | 'duplication' | 'structure' | 'naming' | 'documentation';
  title: string;
  description: string;
  effort: 'low' | 'medium' | 'high';
  autoFixable: boolean;
  affectedFiles: string[];
}

// ============================================================================
// DUPLICATE SUMMARY
// ============================================================================

/**
 * Simplified duplicates summary for audit report
 */
export interface DuplicateSummary {
  /** Total duplicate groups found */
  totalGroups: number;
  /** Groups recommended for merge */
  mergeCount: number;
  /** Groups recommended for rename */
  renameCount: number;
  /** Top duplicate groups (by location count) */
  topDuplicates: Array<{
    name: string;
    similarity: number;
    locationCount: number;
    recommendation: 'merge' | 'rename' | 'keep-both';
    files: string[];
  }>;
}

// ============================================================================
// RANKING SUMMARY
// ============================================================================

/**
 * Simplified ranking summary for audit report
 */
export interface RankingSummary {
  /** Top hotspot modules by PageRank centrality */
  hotspots: Array<{
    path: string;
    pageRank: number;
    percentile: number;
    risk: 'critical' | 'high' | 'medium' | 'low';
    coupling: {
      afferent: number;
      efferent: number;
      instability: number;
    };
  }>;
  /** Safe refactoring order (first N phases) */
  safeOrder: Array<{
    order: number;
    modules: string[];
    risk: 'critical' | 'high' | 'medium' | 'low';
  }>;
  /** Circular dependencies (must refactor together) */
  cycles: string[][];
  /** Leaf nodes (safe to refactor first) */
  leafNodes: string[];
  /** Core nodes (refactor last) */
  coreNodes: string[];
  /** Dependency graph stats */
  stats: {
    nodeCount: number;
    edgeCount: number;
    cycleCount: number;
  };
}

// ============================================================================
// ISSUE CLUSTERING
// ============================================================================

/**
 * A cluster of related issues in the same file with the same category
 *
 * Used to group issues that can be addressed together, reducing noise
 * in the audit output and enabling batch operations.
 */
export interface IssueCluster {
  /** Normalized file path */
  file: string;
  /** Issue category (e.g., 'type-safety', 'lint') */
  category: string;
  /** Number of issues in this cluster */
  count: number;
  /** Line numbers where issues occur */
  locations: number[];
  /** Detected root cause pattern */
  rootCause: string;
  /** Whether issues can be fixed together in one operation */
  fixTogether: boolean;
  /** Suggested approach for fixing */
  suggestedApproach: string;
  /** Original issues (for access to full data) */
  issues: EnrichedIssue[];
}

/**
 * Result of issue clustering operation
 */
export interface ClusteringResult {
  /** Clusters with 3+ issues (worth grouping) */
  clusters: IssueCluster[];
  /** Individual issues that didn't form clusters */
  unclustered: EnrichedIssue[];
  /** Statistics about clustering */
  stats: {
    totalIssues: number;
    clusteredIssues: number;
    unclusteredIssues: number;
    clusterCount: number;
  };
}

// ============================================================================
// GENERATOR OPTIONS
// ============================================================================

/**
 * Options for AI report generation
 */
export interface AIReportOptions {
  /** Path to analyze */
  path?: string | undefined;
  /** Include project context */
  includeContext?: boolean | undefined;
  /** Maximum issues to include in detail */
  maxIssues?: number | undefined;
  /** Include code snippets */
  includeSnippets?: boolean | undefined;
  /** Output format */
  format?: 'markdown' | 'json' | 'xml' | undefined;
  /** Output file path (default: .krolik/AI-REPORT.md) */
  outputPath?: string | undefined;
}
