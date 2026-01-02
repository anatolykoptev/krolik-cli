/**
 * @module commands/audit/enrichment
 * @description Issue enrichment for audit reports
 *
 * Provides enrichment functions that add additional context to issues:
 * - Impact enrichment: dependency analysis, risk levels
 * - Git context: bug history, change frequency, authors
 *
 * ## Usage
 *
 * ```ts
 * import { ImpactEnricher, enrichIssueWithImpact } from './enrichment';
 *
 * // Batch processing (efficient)
 * const enricher = new ImpactEnricher(projectRoot, dependencyGraph);
 * const impact = enricher.enrichIssue(issue);
 *
 * // Single issue (convenience)
 * const impact = enrichIssueWithImpact(issue, projectRoot, dependencyGraph);
 *
 * // Git context enrichment
 * import { getGitContext, formatGitContextXml } from './enrichment';
 *
 * const context = getGitContext('src/utils.ts', { projectRoot });
 * if (context.isHotspot) {
 *   console.log('This file changes frequently!');
 * }
 * ```
 */

// ============================================================================
// IMPACT ENRICHMENT
// ============================================================================

export {
  type EnrichedImpact,
  enrichIssueWithImpact,
  ImpactEnricher,
} from './impact-enrichment';

// ============================================================================
// GIT CONTEXT ENRICHMENT
// ============================================================================

export {
  clearGitContextCache,
  formatGitContextXml,
  getGitContext,
  getGitContextBatch,
  shouldAttachGitContext,
} from './git-context';
export type {
  BugFixCommit,
  GitContext,
  GitContextCacheEntry,
  GitContextOptions,
} from './types';

// ============================================================================
// CODE SNIPPET ENRICHMENT
// ============================================================================

export {
  extractCodeSnippet,
  extractRangeFromContent,
  extractRangeSnippet,
  extractSnippetFromContent,
  formatSnippetAsXml,
} from './code-snippets';
export {
  analyzeComplexityBreakdown,
  analyzeComplexityFromContent,
  formatBreakdownAsXml,
} from './complexity-breakdown';
export type {
  BranchType,
  CodeSnippet,
  ComplexityBranch,
  ComplexityBreakdown,
  IssueCodeContext,
} from './snippet-types';

// ============================================================================
// UNIFIED ENRICHMENT
// ============================================================================

import type { QualityIssue } from '../../fix/core';
import { extractCodeSnippet, formatSnippetAsXml } from './code-snippets';
import { analyzeComplexityBreakdown, formatBreakdownAsXml } from './complexity-breakdown';
import type { IssueCodeContext } from './snippet-types';

/**
 * Enrich an issue with code context
 *
 * Automatically detects issue type and adds appropriate context:
 * - Complexity issues: adds complexity breakdown
 * - All issues: adds code snippet
 *
 * @param issue - The quality issue to enrich
 * @param contextLines - Number of context lines for snippet
 * @returns Code context for the issue
 */
export function enrichIssueWithCodeContext(
  issue: QualityIssue,
  contextLines: number = 5,
): IssueCodeContext {
  const context: IssueCodeContext = {};

  // All issues get a code snippet
  if (issue.line !== undefined) {
    const snippet = extractCodeSnippet(issue.file, issue.line, contextLines);
    if (snippet) {
      context.snippet = snippet;
    }
  }

  // Complexity issues get a detailed breakdown
  if (issue.category === 'complexity' && issue.line !== undefined && isHighComplexityIssue(issue)) {
    const breakdown = analyzeComplexityBreakdown(issue.file, issue.line);
    if (breakdown) {
      context.complexityBreakdown = breakdown;
    }
  }

  return context;
}

/**
 * Format issue code context as XML
 *
 * @param context - The code context to format
 * @param indent - Number of spaces for indentation
 * @returns Formatted XML string
 */
export function formatCodeContextAsXml(context: IssueCodeContext, indent: number = 0): string {
  const lines: string[] = [];

  if (context.snippet) {
    lines.push(formatSnippetAsXml(context.snippet, indent));
  }

  if (context.complexityBreakdown) {
    if (lines.length > 0) lines.push('');
    lines.push(formatBreakdownAsXml(context.complexityBreakdown, indent));
  }

  return lines.join('\n');
}

/**
 * Check if an issue is a high-complexity issue
 */
function isHighComplexityIssue(issue: QualityIssue): boolean {
  const message = issue.message.toLowerCase();
  return (
    message.includes('complexity') ||
    message.includes('cyclomatic') ||
    message.includes('high complexity')
  );
}
