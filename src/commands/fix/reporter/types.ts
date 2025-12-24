/**
 * @module commands/fix/reporter/types
 * @description Types for AI Report Generator
 */

import type { FixDifficulty, QualityCategory, QualityIssue } from '../types';

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
 * Priority level for issue groups
 */
export type PriorityLevel = 'critical' | 'high' | 'medium' | 'low';

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
      }
    | undefined;
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
