/**
 * @module commands/context/formatters/ai/sections/summary
 * @description Executive summary section for AI - compact overview of critical context
 *
 * This section goes FIRST in the output and contains:
 * - Task and domains (what to do)
 * - Git status (what changed)
 * - Critical issues (problems to address)
 * - Recommendations (where to start)
 *
 * Design principles:
 * 1. Fits in ~200 tokens max
 * 2. No verbose descriptions
 * 3. Actionable information only
 * 4. Priority-ordered items
 */

import { abbreviateSeverity } from '@/lib/format';
import type { AiContextData } from '../../../types';

/** Severity levels for issues */
type Severity = 'critical' | 'high' | 'medium' | 'low';

/** Summary stats for quick reference */
interface SummaryStats {
  changedFiles: number;
  stagedFiles: number;
  circularDeps: number;
  missingEnvVars: number;
  qualityIssues: number;
  autoFixable: number;
  actionableTodos: number;
  memoriesCount: number;
}

/** Issue summary with severity */
interface IssueSummary {
  type: string;
  count: number;
  severity: Severity;
  hint: string;
}

/**
 * Collect summary statistics from context data
 */
function collectStats(data: AiContextData): SummaryStats {
  const stats: SummaryStats = {
    changedFiles: 0,
    stagedFiles: 0,
    circularDeps: 0,
    missingEnvVars: 0,
    qualityIssues: 0,
    autoFixable: 0,
    actionableTodos: 0,
    memoriesCount: 0,
  };

  // Git stats
  if (data.git) {
    stats.changedFiles = data.git.changedFiles.length;
    stats.stagedFiles = data.git.stagedFiles.length;
  }

  // Import graph circular deps
  if (data.importGraph) {
    stats.circularDeps = data.importGraph.circular.length;
  }

  // Environment vars
  if (data.envVars) {
    stats.missingEnvVars = data.envVars.missing.length;
  }

  // Quality issues
  if (data.qualityIssues) {
    stats.qualityIssues = data.qualityIssues.length;
    stats.autoFixable = data.qualityIssues.filter((i) => i.autoFixable).length;
  }

  // TODOs
  if (data.todos) {
    stats.actionableTodos = data.todos.filter((t) => !t.isGeneric).length;
  }

  // Memories
  if (data.memories) {
    stats.memoriesCount = data.memories.length;
  }

  return stats;
}

/**
 * Identify critical issues that need immediate attention
 */
function identifyIssues(stats: SummaryStats): IssueSummary[] {
  const issues: IssueSummary[] = [];

  // Circular dependencies are critical
  if (stats.circularDeps > 0) {
    issues.push({
      type: 'circular-deps',
      count: stats.circularDeps,
      severity: 'critical',
      hint: 'extract shared types',
    });
  }

  // Missing env vars
  if (stats.missingEnvVars > 0) {
    issues.push({
      type: 'missing-env',
      count: stats.missingEnvVars,
      severity: stats.missingEnvVars > 5 ? 'high' : 'medium',
      hint: 'add to .env',
    });
  }

  // Quality issues
  if (stats.qualityIssues > 0) {
    issues.push({
      type: 'quality',
      count: stats.qualityIssues,
      severity: stats.qualityIssues > 20 ? 'high' : 'medium',
      hint: stats.autoFixable > 0 ? `${stats.autoFixable} auto-fixable` : 'review needed',
    });
  }

  return issues.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });
}

/**
 * Generate recommendations based on context
 */
function generateRecommendations(data: AiContextData, stats: SummaryStats): string[] {
  const recommendations: string[] = [];

  // If there's a specific task
  if (data.context.task && data.context.task !== 'General development context') {
    recommendations.push(`Focus on: ${data.context.task}`);
  }

  // Critical issues first
  if (stats.circularDeps > 0) {
    recommendations.push('Fix circular dependencies before new code');
  }

  // Auto-fixable issues
  if (stats.autoFixable > 0) {
    recommendations.push(`Run krolik fix for ${stats.autoFixable} auto-fixable issues`);
  }

  // Review changed files
  if (stats.changedFiles > 0) {
    recommendations.push(`Review ${stats.changedFiles} changed files`);
  }

  // Check patterns from memory
  if (stats.memoriesCount > 0) {
    recommendations.push('Check patterns from previous sessions');
  }

  return recommendations.slice(0, 3); // Max 3 recommendations
}

/**
 * Format executive summary section
 *
 * This is the MOST IMPORTANT section for AI efficiency.
 * It provides a compact, actionable overview in ~200 tokens.
 *
 * Attribute abbreviations:
 * - `p` = priority
 * - `n` = count
 * - `t` = type
 * - `s` = severity (abbreviated: CRIT, HIGH, MED, LOW)
 *
 * @example Output:
 * ```xml
 * <summary p="P0">
 *   <task domains="booking,auth">Add booking cancellation feature</task>
 *   <changes n="16" staged="1"/>
 *   <issues>
 *     <issue t="circular-deps" n="2" s="CRIT">extract shared types</issue>
 *   </issues>
 *   <recs>
 *     <r>Fix circular dependencies before new code</r>
 *     <r>Review 16 changed files</r>
 *   </recs>
 *   <has>map,schema,routes,mem</has>
 * </summary>
 * ```
 */
export function formatSummarySection(lines: string[], data: AiContextData): void {
  const stats = collectStats(data);
  const issues = identifyIssues(stats);
  const recommendations = generateRecommendations(data, stats);

  lines.push('  <summary p="P0">');

  // Task with domains - the most important info
  const domains = data.context.domains.join(',');
  const taskTitle = data.context.task || 'General development';
  lines.push(`    <task domains="${domains}">${taskTitle}</task>`);

  // Git changes - compact with short attribute names
  if (stats.changedFiles > 0 || stats.stagedFiles > 0) {
    lines.push(
      `    <changes n="${stats.changedFiles}"${stats.stagedFiles > 0 ? ` staged="${stats.stagedFiles}"` : ''}/>`,
    );
  }

  // Branch info
  if (data.git?.branch) {
    lines.push(`    <branch>${data.git.branch}</branch>`);
  }

  // Critical issues - only if any, using short attribute names and abbreviateSeverity
  if (issues.length > 0) {
    lines.push('    <issues>');
    for (const issue of issues) {
      const abbrevSeverity = abbreviateSeverity(issue.severity);
      lines.push(
        `      <issue t="${issue.type}" n="${issue.count}" s="${abbrevSeverity}">${issue.hint}</issue>`,
      );
    }
    lines.push('    </issues>');
  }

  // Recommendations - actionable guidance
  if (recommendations.length > 0) {
    lines.push('    <recs>');
    for (const rec of recommendations) {
      lines.push(`      <r>${rec}</r>`);
    }
    lines.push('    </recs>');
  }

  // Quick stats for context - compact section names
  const availableSections: string[] = [];
  if (data.repoMap) availableSections.push('map');
  if (data.schema) availableSections.push('schema');
  if (data.routes) availableSections.push('routes');
  if (data.memories && data.memories.length > 0) availableSections.push('mem');
  if (data.libraryDocs && data.libraryDocs.length > 0) availableSections.push('docs');

  if (availableSections.length > 0) {
    lines.push(`    <has>${availableSections.join(',')}</has>`);
  }

  lines.push('  </summary>');
}
