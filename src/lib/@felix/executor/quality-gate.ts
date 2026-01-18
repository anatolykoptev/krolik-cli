/**
 * Quality Gate Types for Ralph Executor
 *
 * Types and interfaces for quality gate configuration and results.
 *
 * @module @ralph/executor/quality-gate
 */

import type { AuditMode } from '@/commands/audit/filters/intent';
import { filterByIntent } from '@/commands/audit/filters/intent';

/**
 * Error handling behavior for quality gate
 * - 'fail-open': Pass on error (risky - may miss bugs if scanner crashes)
 * - 'fail-closed': Fail on error (safe - blocks on scanner failure)
 */
export type QualityGateErrorBehavior = 'fail-open' | 'fail-closed';

/**
 * Configuration for quality gate execution
 */
export interface QualityGateConfig {
  /** Whether the quality gate is enabled */
  enabled: boolean;
  /** Audit mode to run (e.g., 'pre-commit', 'release', 'all') */
  auditMode: string;
  /** Whether to fail the process when issues are found */
  failOnIssues: boolean;
  /** How to handle scanner errors (default: 'fail-closed' for safety) */
  onError?: QualityGateErrorBehavior;
}

/**
 * Result of quality gate execution
 */
export interface QualityGateResult {
  /** Whether the quality gate passed */
  passed: boolean;
  /** List of issues found during quality gate execution */
  issues: QualityGateIssue[];
  /** Summary of the quality gate execution */
  summary: QualityGateSummary;
}

/**
 * Individual issue found during quality gate execution
 */
export interface QualityGateIssue {
  /** Severity level of the issue */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Category of the issue */
  category: string;
  /** Description of the issue */
  message: string;
  /** File where the issue was found */
  file?: string;
  /** Line number where the issue was found */
  line?: number;
}

/**
 * Summary of quality gate execution results
 */
export interface QualityGateSummary {
  /** Total number of issues found */
  totalIssues: number;
  /** Number of critical issues */
  critical: number;
  /** Number of high severity issues */
  high: number;
  /** Number of medium severity issues */
  medium: number;
  /** Number of low severity issues */
  low: number;
  /** Execution duration in milliseconds */
  duration: number;
}

/**
 * Run quality gate using krolik_audit
 *
 * @param projectRoot - The project root directory
 * @param config - Quality gate configuration
 * @returns Promise<QualityGateResult> - The quality gate result
 */
export async function runQualityGate(
  projectRoot: string,
  config: QualityGateConfig,
): Promise<QualityGateResult> {
  if (!config.enabled) {
    return {
      passed: true,
      issues: [],
      summary: {
        totalIssues: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        duration: 0,
      },
    };
  }

  const startTime = Date.now();
  const auditMode = (config.auditMode || 'pre-commit') as AuditMode;

  try {
    // Import audit analysis function (more direct than reporter)
    const { analyzeQuality } = await import('@/commands/fix/analyze');

    // Run quality analysis
    const qualityResult = await analyzeQuality(projectRoot, { includeTests: false });

    // Collect all issues from the quality report
    const allIssues = qualityResult.report.files.flatMap((file) => file.issues);

    // Filter issues by audit mode (pre-commit, release, etc.) - Ralph's good idea
    const filteredIssues = filterByIntent(allIssues, { mode: auditMode });

    // Parse issues and count by severity
    const issues: QualityGateIssue[] = [];
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    for (const issue of filteredIssues) {
      // Map category to severity based on issue type
      let severity: QualityGateIssue['severity'];

      // Security issues are always critical
      if (issue.category === 'security') {
        severity = 'critical';
        critical++;
      }
      // Type-safety issues are high severity
      else if (issue.category === 'type-safety') {
        severity = 'high';
        high++;
      }
      // Lint issues are low severity (auto-fixable)
      else if (issue.category === 'lint') {
        severity = 'low';
        low++;
      }
      // Default to medium for other categories
      else {
        severity = 'medium';
        medium++;
      }

      issues.push({
        severity,
        category: issue.category,
        message: issue.message,
        file: issue.file,
        ...(issue.line !== undefined && { line: issue.line }),
      });
    }

    const duration = Date.now() - startTime;
    const totalIssues = issues.length;

    // Determine if quality gate passed based on configuration
    let passed = true;
    if (config.failOnIssues) {
      // For 'pre-commit' mode, fail on critical issues only
      if (config.auditMode === 'pre-commit') {
        passed = critical === 0;
      }
      // For 'release' mode, fail on critical or high issues
      else if (config.auditMode === 'release') {
        passed = critical === 0 && high === 0;
      }
      // For other modes, fail if any issues found
      else {
        passed = totalIssues === 0;
      }
    }

    return {
      passed,
      issues,
      summary: {
        totalIssues,
        critical,
        high,
        medium,
        low,
        duration,
      },
    };
  } catch (error) {
    // Handle errors based on configuration
    // Default: fail-closed (safer - don't let broken scanner pass bad code)
    const errorBehavior = config.onError ?? 'fail-closed';
    const passed = errorBehavior === 'fail-open';
    const duration = Date.now() - startTime;

    return {
      passed,
      issues: [
        {
          severity: passed ? 'low' : 'critical',
          category: 'quality-gate',
          message:
            `Quality gate execution failed: ${error instanceof Error ? error.message : String(error)}. ` +
            `Error behavior: ${errorBehavior}${!passed ? ' - blocking due to scanner failure' : ''}`,
        },
      ],
      summary: {
        totalIssues: 1,
        critical: passed ? 0 : 1,
        high: 0,
        medium: 0,
        low: passed ? 1 : 0,
        duration,
      },
    };
  }
}
