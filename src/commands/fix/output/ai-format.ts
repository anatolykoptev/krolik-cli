/**
 * @module commands/quality/ai-format
 * @description AI-optimized output format for quality analysis
 *
 * This format is designed to give AI assistants actionable information:
 * - Concrete fixes with before/after code
 * - File purpose and role in the system
 * - Impact assessment (what breaks if changed)
 * - Priority based on severity and fix complexity
 */

import { escapeXml } from '@/lib';
import type { FileAnalysis, QualityIssue, QualityReport } from '../types';

// ============================================================================
// AI-ENHANCED TYPES
// ============================================================================

export interface AIFix {
  /** What to change */
  action: 'replace' | 'insert' | 'delete' | 'refactor' | 'extract';
  /** Line number or range */
  location: string;
  /** Current code (if applicable) */
  before?: string;
  /** Suggested code */
  after?: string;
  /** Why this fix helps */
  reason: string;
}

export interface AIIssue {
  id: string;
  file: string;
  line?: number;
  severity: 'critical' | 'important' | 'suggestion';
  category: string;
  /** One-line summary for AI */
  what: string;
  /** Why this matters */
  why: string;
  /** Concrete fix */
  fix: AIFix;
  /** Estimated effort: trivial, small, medium, large */
  effort: 'trivial' | 'small' | 'medium' | 'large';
}

export interface AIFileContext {
  path: string;
  /** What this file does (inferred from content) */
  purpose: string;
  /** File type classification */
  type: string;
  /** Key exports */
  exports: string[];
  /** Files this depends on */
  imports: string[];
  /** Metrics */
  metrics: {
    lines: number;
    functions: number;
    complexity: number;
  };
}

export interface AIReport {
  summary: {
    totalFiles: number;
    filesWithIssues: number;
    critical: number;
    important: number;
    suggestions: number;
  };
  /** Files that need attention, sorted by priority */
  priority: Array<{
    file: string;
    reason: string;
    issueCount: number;
  }>;
  /** All issues with fixes */
  issues: AIIssue[];
  /** File contexts for affected files */
  contexts: AIFileContext[];
}

const MAX_LENGTH = 5;

const MAX_PAGE_SIZE = 50;

const MAX_LIMIT = 15;

// ============================================================================
// FIX GENERATORS
// ============================================================================

/**
 * Generate concrete fix for an issue
 */
function generateFix(issue: QualityIssue, _content?: string): AIFix {
  const { category, message, snippet } = issue;

  // Category-specific fixes
  switch (category) {
    case 'complexity':
      if (message.includes('nesting depth')) {
        return {
          action: 'refactor',
          location: `line ${issue.line}`,
          reason: 'Deep nesting makes code hard to follow',
          after: `// Extract to separate function:\nfunction handleSpecificCase() {\n  // moved logic here\n}`,
        };
      }
      if (message.includes('complexity')) {
        return {
          action: 'extract',
          location: `function at line ${issue.line}`,
          reason: 'High cyclomatic complexity indicates too many branches',
          after: `// Split into:\n// 1. Validation function\n// 2. Main logic function\n// 3. Error handling function`,
        };
      }
      if (message.includes('lines')) {
        return {
          action: 'extract',
          location: `lines ${issue.line}-${(issue.line || 0) + MAX_PAGE_SIZE}`,
          reason: 'Long functions are hard to test and maintain',
          after: `// Extract related logic into helper functions`,
        };
      }
      break;

    case 'lint':
      if (message.includes('console')) {
        return {
          action: 'replace',
          location: `line ${issue.line}`,
          ...(snippet ? { before: snippet } : {}),
          after: `// Remove or use logger:\n// logger.debug(...)`,
          reason: 'Console statements should not be in production code',
        };
      }
      if (message.includes('debugger')) {
        return {
          action: 'delete',
          location: `line ${issue.line}`,
          before: 'debugger;',
          reason: 'Debugger statements break production',
        };
      }
      break;

    case 'type-safety':
      if (message.includes('any')) {
        return {
          action: 'replace',
          location: `line ${issue.line}`,
          before: ': any',
          after: ': unknown // then narrow with type guards',
          reason: 'any disables TypeScript protection',
        };
      }
      if (message.includes('@ts-ignore')) {
        return {
          action: 'delete',
          location: `line ${issue.line}`,
          before: '// @ts-ignore',
          after: '// Fix the actual type error instead',
          reason: '@ts-ignore hides real bugs',
        };
      }
      break;

    case 'srp':
      if (message.includes('exports')) {
        return {
          action: 'refactor',
          location: 'file',
          reason: 'Too many exports indicates mixed responsibilities',
          after: `// Split into:\n// 1. types.ts - type definitions\n// 2. utils.ts - helper functions\n// 3. index.ts - re-exports`,
        };
      }
      if (message.includes('functions')) {
        return {
          action: 'extract',
          location: 'file',
          reason: 'Too many functions in one file',
          after: `// Group related functions into separate modules`,
        };
      }
      break;

    case 'size':
      return {
        action: 'refactor',
        location: 'file',
        reason: 'Large files are hard to navigate and maintain',
        after: `// Split by responsibility:\n// 1. Identify logical groups\n// 2. Extract to separate files\n// 3. Use index.ts for re-exports`,
      };

    case 'hardcoded':
      if (message.includes('number')) {
        return {
          action: 'replace',
          location: `line ${issue.line}`,
          ...(snippet ? { before: snippet } : {}),
          after: `const MEANINGFUL_NAME = ${snippet?.match(/\d+/)?.[0] || 'value'};\n// Use MEANINGFUL_NAME instead`,
          reason: 'Magic numbers are hard to understand and maintain',
        };
      }
      if (message.includes('string')) {
        return {
          action: 'replace',
          location: `line ${issue.line}`,
          ...(snippet ? { before: snippet } : {}),
          after: `// Move to i18n:\n// t('key.path')`,
          reason: 'Hardcoded text prevents localization',
        };
      }
      break;
  }

  // Default fix
  return {
    action: 'refactor',
    location: issue.line ? `line ${issue.line}` : 'file',
    reason: issue.suggestion || 'See issue description',
  };
}

/**
 * Map severity to AI-friendly level
 */
function mapSeverity(severity: string): AIIssue['severity'] {
  switch (severity) {
    case 'error':
      return 'critical';
    case 'warning':
      return 'important';
    default:
      return 'suggestion';
  }
}

/**
 * Estimate fix effort
 */
function estimateEffort(issue: QualityIssue): AIIssue['effort'] {
  const { category, message } = issue;

  // Trivial fixes
  if (category === 'lint' && (message.includes('console') || message.includes('debugger'))) {
    return 'trivial';
  }

  // Small fixes
  if (category === 'type-safety' || category === 'hardcoded') {
    return 'small';
  }

  // Medium fixes
  if (category === 'complexity' && message.includes('lines')) {
    return 'medium';
  }

  // Large fixes
  if (category === 'srp' || category === 'size' || message.includes('refactor')) {
    return 'large';
  }

  return 'small';
}

// ============================================================================
// CONTEXT GENERATORS
// ============================================================================

/**
 * Infer file purpose from analysis
 */
function inferPurpose(analysis: FileAnalysis): string {
  const { fileType, functions, exports, relativePath } = analysis;

  const purposes: Record<string, string> = {
    component: `React component${exports > 1 ? ' with helpers' : ''}`,
    hook: `Custom React hook for ${relativePath.match(/use(\w+)/)?.[1] || 'state management'}`,
    router: 'tRPC router with API procedures',
    schema: 'Validation schemas (Zod/Prisma)',
    util: 'Utility functions',
    test: 'Test suite',
    config: 'Configuration',
  };

  let purpose = purposes[fileType] || 'Module';

  if (functions.length > 0) {
    const mainFn = functions.find((f) => f.isExported) || functions[0];
    if (mainFn) {
      purpose += ` (main: ${mainFn.name})`;
    }
  }

  return purpose;
}

/**
 * Extract key exports
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];
  const patterns = [
    /export\s+(?:const|function|class|type|interface)\s+(\w+)/g,
    /export\s+\{\s*([^}]+)\s*\}/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const names = match[1]?.split(',').map((n) => n.trim()) || [];
      exports.push(...names.filter((n) => n && !n.includes(' ')));
    }
  }

  return exports.slice(0, 10); // Limit to 10
}

/**
 * Extract imports
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  const pattern = /from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = pattern.exec(content)) !== null) {
    if (match[1]) imports.push(match[1]);
  }

  return [...new Set(imports)].slice(0, MAX_LIMIT); // Unique, limit to 15
}

/**
 * Build file context
 */
function buildContext(analysis: FileAnalysis, content: string): AIFileContext {
  const avgComplexity =
    analysis.functions.length > 0
      ? Math.round(
          analysis.functions.reduce((sum, f) => sum + f.complexity, 0) / analysis.functions.length,
        )
      : 0;

  return {
    path: analysis.relativePath,
    purpose: inferPurpose(analysis),
    type: analysis.fileType,
    exports: extractExports(content),
    imports: extractImports(content),
    metrics: {
      lines: analysis.lines,
      functions: analysis.functions.length,
      complexity: avgComplexity,
    },
  };
}

// ============================================================================
// MAIN TRANSFORMER
// ============================================================================

/**
 * Transform QualityIssue to AIIssue
 */
function transformIssue(issue: QualityIssue): AIIssue {
  return {
    id: `${issue.category}-${issue.line || 0}`,
    file: issue.file,
    ...(issue.line !== undefined ? { line: issue.line } : {}),
    severity: mapSeverity(issue.severity),
    category: issue.category,
    what: issue.message,
    why: issue.suggestion || 'Improves code quality',
    fix: generateFix(issue),
    effort: estimateEffort(issue),
  };
}

/**
 * Transform full report to AI format
 */
export function transformToAIFormat(
  report: QualityReport,
  fileContents: Map<string, string>,
): AIReport {
  // Transform issues
  const issues = report.topIssues.map(transformIssue);

  // Count by severity
  const critical = issues.filter((i) => i.severity === 'critical').length;
  const important = issues.filter((i) => i.severity === 'important').length;
  const suggestions = issues.filter((i) => i.severity === 'suggestion').length;

  // Build priority list
  const fileIssueCounts = new Map<string, number>();
  for (const issue of issues) {
    fileIssueCounts.set(issue.file, (fileIssueCounts.get(issue.file) || 0) + 1);
  }

  const priority = [...fileIssueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([file, count]) => {
      const fileIssues = issues.filter((i) => i.file === file);
      const criticalCount = fileIssues.filter((i) => i.severity === 'critical').length;
      return {
        file,
        reason: criticalCount > 0 ? `${criticalCount} critical issues` : `${count} issues`,
        issueCount: count,
      };
    });

  // Build contexts for affected files
  const affectedFiles = new Set(issues.map((i) => i.file));
  const contexts: AIFileContext[] = [];

  for (const analysis of report.files) {
    if (affectedFiles.has(analysis.relativePath)) {
      const content = fileContents.get(analysis.path) || '';
      contexts.push(buildContext(analysis, content));
    }
  }

  return {
    summary: {
      totalFiles: report.totalFiles,
      filesWithIssues: affectedFiles.size,
      critical,
      important,
      suggestions,
    },
    priority,
    issues,
    contexts,
  };
}

// ============================================================================
// AI-FRIENDLY OUTPUT FORMATTER
// ============================================================================

/**
 * Format AI report as structured XML for AI consumption
 */
export function formatAIReport(aiReport: AIReport): string {
  const lines: string[] = [];

  lines.push('<quality-analysis for="ai-assistant">');
  lines.push('');

  // Summary
  lines.push('<summary>');
  lines.push(
    `  <files total="${aiReport.summary.totalFiles}" with-issues="${aiReport.summary.filesWithIssues}"/>`,
  );
  lines.push(
    `  <issues critical="${aiReport.summary.critical}" important="${aiReport.summary.important}" suggestions="${aiReport.summary.suggestions}"/>`,
  );
  lines.push('</summary>');
  lines.push('');

  // Priority (what to fix first)
  if (aiReport.priority.length > 0) {
    lines.push('<priority-files comment="Fix these first">');
    for (const p of aiReport.priority) {
      lines.push(`  <file path="${p.file}" issues="${p.issueCount}" reason="${p.reason}"/>`);
    }
    lines.push('</priority-files>');
    lines.push('');
  }

  // Issues with fixes
  lines.push('<issues>');
  for (const issue of aiReport.issues) {
    lines.push(`  <issue id="${issue.id}" severity="${issue.severity}" effort="${issue.effort}">`);
    lines.push(`    <file>${issue.file}${issue.line ? `:${issue.line}` : ''}</file>`);
    lines.push(`    <what>${escapeXml(issue.what)}</what>`);
    lines.push(`    <why>${escapeXml(issue.why)}</why>`);
    lines.push(`    <fix action="${issue.fix.action}" location="${issue.fix.location}">`);
    if (issue.fix.before) {
      lines.push(`      <before>${escapeXml(issue.fix.before)}</before>`);
    }
    if (issue.fix.after) {
      lines.push(`      <after>${escapeXml(issue.fix.after)}</after>`);
    }
    lines.push(`      <reason>${escapeXml(issue.fix.reason)}</reason>`);
    lines.push('    </fix>');
    lines.push('  </issue>');
  }
  lines.push('</issues>');
  lines.push('');

  // File contexts
  if (aiReport.contexts.length > 0) {
    lines.push('<file-contexts comment="Context for affected files">');
    for (const ctx of aiReport.contexts) {
      lines.push(`  <file path="${ctx.path}">`);
      lines.push(`    <purpose>${escapeXml(ctx.purpose)}</purpose>`);
      lines.push(`    <type>${ctx.type}</type>`);
      lines.push(
        `    <metrics lines="${ctx.metrics.lines}" functions="${ctx.metrics.functions}" avg-complexity="${ctx.metrics.complexity}"/>`,
      );
      if (ctx.exports.length > 0) {
        lines.push(`    <exports>${ctx.exports.join(', ')}</exports>`);
      }
      if (ctx.imports.length > 0) {
        lines.push(
          `    <imports>${ctx.imports.slice(0, MAX_LENGTH).join(', ')}${ctx.imports.length > MAX_LENGTH ? '...' : ''}</imports>`,
        );
      }
      lines.push('  </file>');
    }
    lines.push('</file-contexts>');
  }

  lines.push('');
  lines.push('</quality-analysis>');

  return lines.join('\n');
}

// escapeXml imported from lib/formatters
