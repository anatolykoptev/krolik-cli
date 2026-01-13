/**
 * @module commands/audit/enrichment/types
 * @description Types for git context enrichment in audit issues
 *
 * Provides git history context to show why an issue matters:
 * - Bug history indicates areas with recurring problems
 * - Change frequency indicates hotspots
 * - Related bug commits provide evidence
 */

// ============================================================================
// GIT CONTEXT
// ============================================================================

/**
 * Git context for an issue location
 *
 * Provides historical context to help prioritize:
 * - Files with many bug fixes need careful handling
 * - Frequently changed files are hotspots
 * - Related bug commits show patterns
 */
export interface GitContext {
  /** Number of bug-fix commits in last 30 days */
  recentBugFixes: number;

  /** Total number of commits touching this file in last 30 days */
  totalChanges: number;

  /** Date of last modification (ISO date string) */
  lastModified: string;

  /** Authors who have touched this file recently */
  authors: string[];

  /** Whether this file is a hotspot (frequently changed) */
  isHotspot: boolean;

  /** Commit messages from bug-fix commits */
  relatedBugs: BugFixCommit[];

  /** Warning message if this is a risky area */
  warning?: string;
}

/**
 * Bug-fix commit information
 */
export interface BugFixCommit {
  /** Short commit hash */
  hash: string;

  /** Commit message */
  message: string;

  /** Commit date (ISO date string) */
  date: string;
}

/**
 * Options for git context retrieval
 */
export interface GitContextOptions {
  /** Project root directory */
  projectRoot: string;

  /** Period in days to analyze (default: 30) */
  periodDays?: number;

  /** Threshold for hotspot detection - percentile (default: 80) */
  hotspotThreshold?: number;

  /** Threshold for bug frequency warning (default: 3) */
  bugWarningThreshold?: number;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

/**
 * Cache entry for git context
 */
export interface GitContextCacheEntry {
  /** The cached git context */
  context: GitContext;

  /** Cache timestamp */
  cachedAt: number;
}
