/**
 * @module types/severity
 * @description Shared severity and priority types used across commands
 *
 * These types are extracted to break circular dependencies and ensure consistency.
 * Based on Google Engineering Practices for code review.
 */

/**
 * Shared severity type (3-level) for issues, warnings, info
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * Shared priority type (4-level) for task prioritization
 */
export type Priority = 'critical' | 'high' | 'medium' | 'low';

// ============================================================================
// GOOGLE-STYLE SEVERITY (Code Review)
// ============================================================================

/**
 * Google-style severity levels for code review
 * Based on Google's Critique tool and SWE Book Chapter 9
 *
 * @see https://abseil.io/resources/swe-book/html/ch09.html
 */
export type GoogleSeverity = 'must-fix' | 'should-fix' | 'nit' | 'optional';

/**
 * Severity level details with description and blocking status
 */
export interface SeverityInfo {
  level: GoogleSeverity;
  description: string;
  /** Whether this blocks merge/approval */
  blocking: boolean;
  /** Action required */
  action: string;
  /** Weight for health score calculation */
  weight: number;
}

/**
 * Severity definitions with descriptions
 */
export const SEVERITY_INFO: Record<GoogleSeverity, SeverityInfo> = {
  'must-fix': {
    level: 'must-fix',
    description: 'Security, correctness, crashes - requires immediate fix',
    blocking: true,
    action: 'Required before merge',
    weight: 10,
  },
  'should-fix': {
    level: 'should-fix',
    description: 'Performance, maintainability - address this sprint',
    blocking: false,
    action: 'Address this sprint',
    weight: 3,
  },
  nit: {
    level: 'nit',
    description: 'Style, naming, formatting - nice to fix',
    blocking: false,
    action: 'Nice to fix',
    weight: 1,
  },
  optional: {
    level: 'optional',
    description: 'Suggestions, alternatives - consider',
    blocking: false,
    action: 'Consider',
    weight: 0.1,
  },
};

/**
 * Map legacy Priority to Google-style Severity
 */
export function priorityToSeverity(priority: Priority): GoogleSeverity {
  switch (priority) {
    case 'critical':
      return 'must-fix';
    case 'high':
      return 'should-fix';
    case 'medium':
      return 'nit';
    case 'low':
      return 'optional';
  }
}

/**
 * Map Google-style Severity to legacy Priority
 */
export function severityToPriority(severity: GoogleSeverity): Priority {
  switch (severity) {
    case 'must-fix':
      return 'critical';
    case 'should-fix':
      return 'high';
    case 'nit':
      return 'medium';
    case 'optional':
      return 'low';
  }
}

// ============================================================================
// CONFIDENCE SCORING
// ============================================================================

/**
 * Confidence level for issue detection
 * Based on detection method accuracy
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Confidence score with reasoning
 */
export interface ConfidenceScore {
  /** Confidence percentage (0-100) */
  score: number;
  /** Confidence level bucket */
  level: ConfidenceLevel;
  /** Factors contributing to confidence */
  factors: ConfidenceFactor[];
}

/**
 * Factor contributing to confidence score
 */
export interface ConfidenceFactor {
  name: string;
  contribution: number;
  description: string;
}

/**
 * Default confidence thresholds
 * Google principle: Zero False Positives > High Recall
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Show always (80-100%) */
  high: 80,
  /** Show with --verbose (60-79%) */
  medium: 60,
  /** Show only with --strict (0-59%) */
  low: 0,
} as const;

/**
 * Calculate confidence level from score
 */
export function scoreToConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Base confidence scores by detection method
 */
export const DETECTION_CONFIDENCE: Record<string, number> = {
  /** AST-based detection (most accurate) */
  ast: 40,
  /** Type information available */
  typed: 20,
  /** Context-aware analysis */
  contextual: 20,
  /** Historical accuracy (fix rate) */
  historical: 20,
  /** Regex-based (least accurate) */
  regex: 10,
  /** Heuristic-based */
  heuristic: 15,
};
