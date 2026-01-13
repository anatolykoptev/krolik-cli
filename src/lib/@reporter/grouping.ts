/**
 * @module commands/fix/reporter/grouping
 * @description Issue grouping and prioritization logic
 */

import * as path from 'node:path';
import { groupBy } from '@/lib/@core';
import { priorityToSeverity } from '@/types/severity';
import { type ConfidenceOptions, calculateConfidence } from '../../commands/audit/confidence';
import type { QualityCategory, QualityIssue } from '../../commands/fix/core';
import { getFixDifficulty } from '../../commands/fix/core';
import { enrichIssueWithCodeContext } from '../@krolik/enrichment';
import { aggregateEffort, estimateEffort } from './effort';
import type { EnrichedIssue, IssueGroup, PriorityLevel } from './types';

// ============================================================================
// PATH NORMALIZATION
// ============================================================================

/**
 * Normalize file path to relative path from project root
 * Handles both absolute and relative paths, deduplicates entries
 */
export function normalizePath(filePath: string, projectRoot?: string): string {
  // If already relative (doesn't start with /), return as-is
  if (!filePath.startsWith('/')) {
    return filePath;
  }

  // Try to make relative to common project patterns
  const patterns = ['/packages/', '/apps/', '/src/', '/lib/'];

  for (const pattern of patterns) {
    const idx = filePath.indexOf(pattern);
    if (idx !== -1) {
      // Return path from after the pattern prefix (e.g., "src/...")
      return filePath.substring(idx + 1);
    }
  }

  // If projectRoot provided, use it
  if (projectRoot && filePath.startsWith(projectRoot)) {
    return filePath.substring(projectRoot.length + 1);
  }

  // Fallback: return basename if nothing else works
  return path.basename(filePath);
}

// ============================================================================
// PRIORITY RULES
// ============================================================================

/**
 * Priority by category
 */
const CATEGORY_PRIORITY: Record<QualityCategory, PriorityLevel> = {
  'type-safety': 'critical', // Type errors break builds
  'circular-dep': 'critical', // Can cause runtime issues
  security: 'critical', // Security vulnerabilities need immediate attention
  lint: 'low', // Usually cosmetic
  hardcoded: 'medium', // Maintainability
  documentation: 'low', // Not urgent
  complexity: 'medium', // Technical debt
  srp: 'high', // Architectural issue
  'mixed-concerns': 'high', // Architectural issue
  size: 'medium', // Technical debt
  composite: 'medium', // Multi-file ops
  agent: 'medium', // AI operations
  refine: 'high', // @namespace structure
  modernization: 'low', // Legacy patterns (require, sync fs)
  i18n: 'medium', // Localization improvements
  'backwards-compat': 'medium', // Backwards compatibility shims
  'duplicate-query': 'medium', // Duplicate Prisma/tRPC queries
};

// ============================================================================
// ENRICHMENT
// ============================================================================

/**
 * Check if an issue is auto-fixable
 */
function isAutoFixable(issue: QualityIssue): boolean {
  const difficulty = getFixDifficulty(issue);
  if (difficulty === 'trivial') return true;

  // Category-based auto-fix rules
  switch (issue.category) {
    case 'lint':
      return (
        issue.message.includes('console') ||
        issue.message.includes('debugger') ||
        issue.message.includes('alert')
      );
    case 'type-safety':
      return issue.message.includes('@ts-ignore') || issue.message.includes('@ts-nocheck');
    case 'hardcoded':
      return false; // Need human naming decision
    case 'documentation':
      return false; // Need human documentation
    default:
      return false;
  }
}

/**
 * Determine priority for an issue
 */
function determinePriority(issue: QualityIssue): PriorityLevel {
  // Severity takes precedence
  if (issue.severity === 'error') return 'critical';

  // Then category
  const categoryPriority = CATEGORY_PRIORITY[issue.category];

  // Adjust based on message content
  const msg = issue.message.toLowerCase();

  // Command injection is critical (remote code execution risk)
  if (msg.includes('injection')) return 'critical';

  // Path traversal is high, not critical (local CLI, user controls input)
  // False positives common with hardcoded patterns from arrays/objects
  if (msg.includes('path traversal')) return 'high';

  // Other security issues are critical
  if (msg.includes('security')) return 'critical';

  if (msg.includes('performance') || msg.includes('memory')) return 'high';

  return categoryPriority;
}

/**
 * Enrich a single issue with effort and priority
 *
 * @param issue - The quality issue to enrich
 * @param options - Optional enrichment options
 * @param options.includeCodeContext - Whether to include code snippets (default: false for perf)
 */
export function enrichIssue(
  issue: QualityIssue,
  options: { includeCodeContext?: boolean } = {},
): EnrichedIssue {
  const effort = estimateEffort(issue);
  const difficulty = getFixDifficulty(issue);
  const priority = determinePriority(issue);
  const autoFixable = isAutoFixable(issue);

  // Google-style severity (must-fix, should-fix, nit, optional)
  const severity = priorityToSeverity(priority);

  // Calculate confidence score
  const confidenceOptions: ConfidenceOptions = {
    category: issue.category,
    pattern: detectPattern(issue),
    method: {
      ast: true, // Most detections are AST-based
      typed: issue.category === 'type-safety',
      contextual: issue.category === 'complexity' || issue.category === 'srp',
    },
    context: {
      isTest: issue.file.includes('.test.') || issue.file.includes('__tests__'),
      isGenerated: issue.file.includes('.generated.') || issue.file.includes('/generated/'),
    },
  };
  const confidence = calculateConfidence(confidenceOptions);

  const enriched: EnrichedIssue = {
    issue,
    effort,
    difficulty,
    priority,
    autoFixable,
    severity,
    confidence,
  };

  if (issue.suggestion) {
    enriched.fixSuggestion = issue.suggestion;
  }

  // Add code context for high-priority or complexity issues
  if (options.includeCodeContext && shouldIncludeCodeContext(issue, priority)) {
    const codeContext = enrichIssueWithCodeContext(issue);
    if (codeContext.snippet || codeContext.complexityBreakdown) {
      enriched.codeContext = codeContext;
    }
  }

  return enriched;
}

/**
 * Detect pattern from issue message for confidence calculation
 */
function detectPattern(issue: QualityIssue): string | undefined {
  const msg = issue.message.toLowerCase();

  // Lint patterns
  if (msg.includes('console')) return 'console-log';
  if (msg.includes('debugger')) return 'debugger';
  if (msg.includes('alert')) return 'alert';

  // Type safety patterns
  if (msg.includes('any')) return 'any-usage';
  if (msg.includes('@ts-ignore')) return 'ts-ignore';
  if (msg.includes('@ts-nocheck')) return 'ts-nocheck';

  // Security patterns
  if (msg.includes('sql') && msg.includes('injection')) return 'sql-injection';
  if (msg.includes('path traversal')) return 'path-traversal';
  if (msg.includes('command injection')) return 'command-injection';

  // Complexity
  if (msg.includes('complexity')) return 'high-complexity';

  // Hardcoded
  if (msg.includes('hardcoded') && msg.includes('url')) return 'hardcoded-url';
  if (msg.includes('hardcoded') && msg.includes('number')) return 'hardcoded-number';
  if (msg.includes('hardcoded')) return 'hardcoded-string';

  // Documentation
  if (msg.includes('jsdoc') || msg.includes('documentation')) return 'missing-jsdoc';

  return undefined;
}

/**
 * Check if an issue should include code context
 * Only for critical/high priority or complexity issues
 */
function shouldIncludeCodeContext(issue: QualityIssue, priority: PriorityLevel): boolean {
  // Always include for critical/high priority
  if (priority === 'critical' || priority === 'high') {
    return true;
  }

  // Include for complexity issues
  if (issue.category === 'complexity') {
    return true;
  }

  return false;
}

// ============================================================================
// GROUPING STRATEGIES
// ============================================================================

/**
 * Group issues by file
 */
export function groupByFile(issues: EnrichedIssue[]): IssueGroup[] {
  const fileMap = groupBy(issues, (i) => i.issue.file);

  const groups: IssueGroup[] = [];
  for (const [file, fileIssues] of fileMap) {
    groups.push(createGroup(`file:${file}`, fileIssues, file));
  }

  return groups.sort((a, b) => b.count - a.count);
}

/**
 * Group issues by category
 */
export function groupByCategory(issues: EnrichedIssue[]): IssueGroup[] {
  const categoryMap = groupBy(issues, (i) => i.issue.category);

  const groups: IssueGroup[] = [];
  for (const [category, catIssues] of categoryMap) {
    groups.push(createCategoryGroup(category as QualityCategory, catIssues));
  }

  return groups.sort((a, b) => priorityOrder(a.priority) - priorityOrder(b.priority));
}

/**
 * Group issues by priority
 */
export function groupByPriority(issues: EnrichedIssue[]): IssueGroup[] {
  const priorityMap = groupBy(issues, (i) => i.priority);

  const groups: IssueGroup[] = [];
  const priorities: PriorityLevel[] = ['critical', 'high', 'medium', 'low'];

  for (const priority of priorities) {
    const prioIssues = priorityMap.get(priority);
    if (prioIssues && prioIssues.length > 0) {
      groups.push(createPriorityGroup(priority, prioIssues));
    }
  }

  return groups;
}

// ============================================================================
// GROUP CREATION HELPERS
// ============================================================================

/**
 * Create a group from enriched issues
 */
function createGroup(id: string, issues: EnrichedIssue[], title: string): IssueGroup {
  const efforts = issues.map((i) => i.effort);
  const totalEffort = aggregateEffort(efforts);
  const autoFixableCount = issues.filter((i) => i.autoFixable).length;

  // Determine group priority (highest priority issue)
  const priority = issues.reduce<PriorityLevel>((highest, i) => {
    return priorityOrder(i.priority) < priorityOrder(highest) ? i.priority : highest;
  }, 'low');

  // Determine group category
  const categories = new Set(issues.map((i) => i.issue.category));
  const firstCategory = [...categories][0];
  const category: QualityCategory | 'mixed' =
    categories.size === 1 && firstCategory ? firstCategory : 'mixed';

  return {
    id,
    title,
    description: `${issues.length} issue(s) found`,
    priority,
    category,
    totalEffort,
    count: issues.length,
    autoFixableCount,
    issues,
  };
}

/**
 * Create a category-based group
 */
function createCategoryGroup(category: QualityCategory, issues: EnrichedIssue[]): IssueGroup {
  const titles: Record<QualityCategory, string> = {
    lint: 'Lint Issues (console, debugger, etc.)',
    'type-safety': 'Type Safety Issues',
    hardcoded: 'Hardcoded Values',
    documentation: 'Missing Documentation',
    complexity: 'Code Complexity',
    srp: 'Single Responsibility Violations',
    'mixed-concerns': 'Mixed Concerns',
    size: 'File Size Issues',
    'circular-dep': 'Circular Dependencies',
    composite: 'Composite Operations',
    agent: 'AI Agent Operations',
    refine: '@Namespace Structure Issues',
    security: 'Security Issues',
    modernization: 'Legacy Code Patterns',
    i18n: 'Hardcoded Text (I18n)',
    'backwards-compat': 'Backwards Compatibility Shims',
    'duplicate-query': 'Duplicate Query Issues',
  };

  const descriptions: Record<QualityCategory, string> = {
    lint: 'Remove debug statements and improve code hygiene',
    'type-safety': 'Fix type annotations and remove unsafe patterns',
    hardcoded: 'Extract magic numbers and strings to constants',
    documentation: 'Add JSDoc to exported functions',
    complexity: 'Simplify complex functions and reduce nesting',
    srp: 'Split large files into focused modules',
    'mixed-concerns': 'Separate UI from business logic',
    size: 'Break down oversized files',
    'circular-dep': 'Restructure to eliminate circular imports',
    composite: 'Multi-file refactoring operations',
    agent: 'AI-assisted code improvements',
    refine: 'Migrate lib/ to @namespace pattern',
    security: 'Fix security vulnerabilities and unsafe patterns',
    modernization: 'Update require() to import and sync fs to async',
    i18n: 'Extract hardcoded text to translation keys',
    'backwards-compat': 'Delete deprecated shim files and update imports',
    'duplicate-query': 'Extract duplicate queries to shared hooks/functions',
  };

  const group = createGroup(`category:${category}`, issues, titles[category]);
  group.description = descriptions[category];
  group.category = category;

  return group;
}

/**
 * Create a priority-based group
 */
function createPriorityGroup(priority: PriorityLevel, issues: EnrichedIssue[]): IssueGroup {
  const titles: Record<PriorityLevel, string> = {
    critical: 'Critical Issues (Fix Immediately)',
    high: 'High Priority Issues',
    medium: 'Medium Priority Issues',
    low: 'Low Priority Issues (Optional)',
  };

  const descriptions: Record<PriorityLevel, string> = {
    critical: 'These issues may cause build failures or runtime errors',
    high: 'These issues should be addressed in the current sprint',
    medium: 'Address these for better maintainability',
    low: 'Nice to fix but not urgent',
  };

  const group = createGroup(`priority:${priority}`, issues, titles[priority]);
  group.description = descriptions[priority];
  group.priority = priority;

  return group;
}

/**
 * Get numeric order for priority (lower = higher priority)
 */
function priorityOrder(priority: PriorityLevel): number {
  const order: Record<PriorityLevel, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[priority];
}

// ============================================================================
// QUICK WINS
// ============================================================================

/**
 * Extract quick wins (trivial auto-fixable issues)
 */
export function extractQuickWins(issues: EnrichedIssue[], limit = 10): EnrichedIssue[] {
  return issues
    .filter((i) => i.autoFixable && i.effort.level === 'trivial')
    .sort((a, b) => a.effort.minutes - b.effort.minutes)
    .slice(0, limit);
}

/**
 * Extract hotspot files (files with most issues)
 * Normalizes paths to avoid duplicates from absolute/relative paths
 * Default limit is 5 to match the Hotspots table display
 */
export function extractHotspots(
  issues: EnrichedIssue[],
  limit = 5,
): Array<{ file: string; issueCount: number; priority: PriorityLevel }> {
  const fileMap = new Map<string, { count: number; priority: PriorityLevel }>();

  for (const enriched of issues) {
    // Normalize path to avoid duplicates
    const file = normalizePath(enriched.issue.file);
    const existing = fileMap.get(file);

    if (existing) {
      existing.count++;
      if (priorityOrder(enriched.priority) < priorityOrder(existing.priority)) {
        existing.priority = enriched.priority;
      }
    } else {
      fileMap.set(file, { count: 1, priority: enriched.priority });
    }
  }

  return [...fileMap.entries()]
    .map(([file, data]) => ({ file, issueCount: data.count, priority: data.priority }))
    .sort((a, b) => b.issueCount - a.issueCount)
    .slice(0, limit);
}
