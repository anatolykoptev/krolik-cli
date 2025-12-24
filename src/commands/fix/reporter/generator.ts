/**
 * @module commands/fix/reporter/generator
 * @description AI Report Generator - creates structured reports for AI agents
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FileAnalysis, QualityIssue, QualityReport } from '../types';
import { aggregateEffort } from './effort';
import { enrichIssue, extractHotspots, extractQuickWins, groupByPriority } from './grouping';
import type {
  ActionStep,
  AIReport,
  AIReportOptions,
  AIRuleFile,
  EffortLevel,
  EnrichedIssue,
  FileContext,
  GitInfo,
  NextActionItem,
  PriorityLevel,
  ReportContext,
  ReportSummary,
} from './types';

// ============================================================================
// GIT INFO
// ============================================================================

/**
 * Execute a git command and return the output
 */
function gitExec(cmd: string, cwd: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return '';
  }
}

/**
 * Get git information for the report
 */
function getGitInfo(projectRoot: string): GitInfo | undefined {
  const branch = gitExec('git branch --show-current', projectRoot);
  if (!branch) return undefined;

  const statusOutput = gitExec('git status --porcelain', projectRoot);
  const lines = statusOutput.split('\n').filter(Boolean);

  let modified = 0;
  let untracked = 0;
  let staged = 0;

  for (const line of lines) {
    const index = line[0];
    const worktree = line[1];

    if (index === '?' && worktree === '?') {
      untracked++;
    } else if (index !== ' ' && index !== '?') {
      staged++;
    }
    if (worktree === 'M' || worktree === 'D') {
      modified++;
    }
  }

  // Get recent commits
  const commitsOutput = gitExec('git log --oneline -5 --format="%h|%s|%cr"', projectRoot);
  const recentCommits = commitsOutput
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, message, relativeDate] = line.split('|');
      return { hash: hash ?? '', message: message ?? '', relativeDate: relativeDate ?? '' };
    });

  return { branch, modified, untracked, staged, recentCommits };
}

// ============================================================================
// AI RULES
// ============================================================================

/**
 * Find AI rules files in the project
 */
function findAIRulesFiles(projectRoot: string): AIRuleFile[] {
  const files: AIRuleFile[] = [];

  // Check for CLAUDE.md at root
  if (fs.existsSync(path.join(projectRoot, 'CLAUDE.md'))) {
    files.push({ path: 'CLAUDE.md', scope: 'root' });
  }

  // Check for .claude directory
  const claudeDir = path.join(projectRoot, '.claude');
  if (fs.existsSync(claudeDir) && fs.statSync(claudeDir).isDirectory()) {
    const claudeFiles = fs.readdirSync(claudeDir).filter((f) => f.endsWith('.md'));
    for (const f of claudeFiles) {
      files.push({ path: `.claude/${f}`, scope: 'root' });
    }
  }

  return files;
}

// ============================================================================
// NEXT ACTION & DO-NOT
// ============================================================================

/**
 * Determine next action based on issues
 */
function determineNextAction(summary: ReportSummary, aiRules: AIRuleFile[]): NextActionItem {
  // 1. If there are AI rules, read them first
  if (aiRules.length > 0) {
    return {
      priority: 'critical',
      action: `Read AI rules files: ${aiRules.map((r) => r.path).join(', ')}`,
      reason: 'Project has AI configuration files that define conventions and rules',
    };
  }

  // 2. If there are critical issues, fix them first
  if (summary.byPriority.critical > 0) {
    return {
      priority: 'critical',
      action: `Fix ${summary.byPriority.critical} critical issue(s) immediately`,
      reason: 'Critical issues may cause runtime errors or security vulnerabilities',
    };
  }

  // 3. If there are high priority issues
  if (summary.byPriority.high > 0) {
    return {
      priority: 'high',
      action: `Address ${summary.byPriority.high} high-priority issue(s)`,
      reason: 'High priority issues indicate architectural problems',
    };
  }

  // 4. Quick wins - auto-fixable issues
  if (summary.autoFixableIssues > 0) {
    return {
      priority: 'medium',
      action: `Auto-fix ${summary.autoFixableIssues} trivial issue(s)`,
      reason: 'Quick wins can be fixed automatically in seconds',
    };
  }

  // 5. Manual issues
  if (summary.totalIssues > 0) {
    return {
      priority: 'low',
      action: `Review ${summary.totalIssues} issue(s) for improvements`,
      reason: 'Code quality can be improved with these fixes',
    };
  }

  return {
    priority: 'low',
    action: 'Code looks good! Ready for development',
    reason: 'No significant issues found',
  };
}

/**
 * Generate do-not rules based on issues found
 */
function generateDoNotRules(summary: ReportSummary): string[] {
  const rules: string[] = [
    'Do not commit without running typecheck first',
    'Do not push directly to main/master branch',
    'Do not ignore TypeScript errors with @ts-ignore',
  ];

  // Add rules based on issues found
  if (summary.byCategory['type-safety'] && summary.byCategory['type-safety'] > 0) {
    rules.push('Do not use `any` type — use proper type definitions');
  }

  if (summary.byCategory.hardcoded && summary.byCategory.hardcoded > 0) {
    rules.push('Do not use magic numbers — extract to named constants');
  }

  if (summary.byCategory.complexity && summary.byCategory.complexity > 0) {
    rules.push('Do not write functions longer than 50 lines — extract helper functions');
  }

  if (summary.byCategory.srp && summary.byCategory.srp > 0) {
    rules.push('Do not export more than 5 items per file — split into modules');
  }

  if (summary.byCategory.lint && summary.byCategory.lint > 0) {
    rules.push('Do not leave console.log in production code');
  }

  return rules;
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

/**
 * Build report context from project info
 */
function buildContext(
  projectRoot: string,
  gitInfo?: { branch?: string; status?: { modified: number; untracked: number; staged: number } },
): ReportContext {
  const context: ReportContext = {
    projectRoot,
  };

  if (gitInfo) {
    context.gitBranch = gitInfo.branch;
    context.gitStatus = gitInfo.status;
  }

  // Detect tech stack
  const techStack: string[] = [];
  const packageJsonPath = path.join(projectRoot, 'package.json');

  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.typescript) techStack.push('TypeScript');
      if (deps.react || deps['react-dom']) techStack.push('React');
      if (deps.next) techStack.push('Next.js');
      if (deps['@trpc/server']) techStack.push('tRPC');
      if (deps['@prisma/client']) techStack.push('Prisma');
      if (deps.zod) techStack.push('Zod');
      if (deps.tailwindcss) techStack.push('Tailwind CSS');
      if (deps.expo) techStack.push('Expo');
    } catch {
      // Ignore parse errors
    }
  }

  if (techStack.length > 0) {
    context.techStack = techStack;
  }

  return context;
}

// ============================================================================
// SUMMARY CALCULATION
// ============================================================================

/**
 * Calculate report summary
 */
function calculateSummary(enrichedIssues: EnrichedIssue[]): ReportSummary {
  const autoFixableIssues = enrichedIssues.filter((i) => i.autoFixable).length;
  const efforts = enrichedIssues.map((i) => i.effort);
  const totalEffort = aggregateEffort(efforts);

  // Count by priority
  const byPriority: Record<PriorityLevel, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const issue of enrichedIssues) {
    byPriority[issue.priority]++;
  }

  // Count by category
  const byCategory: Record<string, number> = {};
  for (const issue of enrichedIssues) {
    const cat = issue.issue.category;
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }

  // Count by effort
  const byEffort: Record<EffortLevel, number> = {
    trivial: 0,
    small: 0,
    medium: 0,
    large: 0,
    complex: 0,
  };
  for (const issue of enrichedIssues) {
    byEffort[issue.effort.level]++;
  }

  return {
    totalIssues: enrichedIssues.length,
    autoFixableIssues,
    manualIssues: enrichedIssues.length - autoFixableIssues,
    totalEffortMinutes: totalEffort.minutes,
    totalEffortLabel: totalEffort.timeLabel,
    byPriority,
    byCategory,
    byEffort,
  };
}

// ============================================================================
// EXTENDED SNIPPETS
// ============================================================================

/**
 * Extract extended code snippet with context lines
 * Shows ±contextLines around the issue line with line numbers
 */
function extractExtendedSnippet(
  filePath: string,
  line: number,
  fileContents: Map<string, string> | undefined,
  contextLines = 5,
): string | undefined {
  if (!line) return undefined;

  try {
    // Try to get content from cache first
    let content = fileContents?.get(filePath);

    // Fallback to reading from disk
    if (!content && fs.existsSync(filePath)) {
      content = fs.readFileSync(filePath, 'utf-8');
    }

    if (!content) return undefined;

    const lines = content.split('\n');
    const start = Math.max(0, line - contextLines - 1);
    const end = Math.min(lines.length, line + contextLines);

    return lines
      .slice(start, end)
      .map((l, i) => {
        const num = start + i + 1;
        const marker = num === line ? '→' : ' ';
        return `${marker} ${String(num).padStart(3, ' ')}: ${l}`;
      })
      .join('\n');
  } catch {
    return undefined;
  }
}

// ============================================================================
// ACTION PLAN GENERATION
// ============================================================================

/**
 * Generate action steps from enriched issues
 * For CRITICAL issues: includes extended snippets (±5 lines)
 * For other issues: uses original snippet (1 line)
 */
function generateActionPlan(
  enrichedIssues: EnrichedIssue[],
  fileContents?: Map<string, string>,
  maxSteps = 20,
): ActionStep[] {
  // Sort by priority, then by effort (quick wins first within same priority)
  const sorted = [...enrichedIssues].sort((a, b) => {
    const priorityOrder: Record<PriorityLevel, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.effort.minutes - b.effort.minutes;
  });

  const steps: ActionStep[] = [];
  let stepId = 1;

  for (const enriched of sorted.slice(0, maxSteps)) {
    const { issue, effort, autoFixable, fixSuggestion } = enriched;

    const action: ActionStep['action'] = autoFixable
      ? 'fix'
      : issue.category === 'complexity' || issue.category === 'srp'
        ? 'refactor'
        : 'review';

    const step: ActionStep = {
      id: `step-${stepId++}`,
      action,
      file: issue.file,
      line: issue.line,
      description: issue.message,
      effort,
      priority: enriched.priority,
      category: issue.category,
    };

    // Add code snippet based on priority
    // CRITICAL: extended snippet (±5 lines) for better context
    // Others: original snippet (1 line) for brevity
    if (enriched.priority === 'critical' && issue.line) {
      const extendedSnippet = extractExtendedSnippet(issue.file, issue.line, fileContents, 5);
      if (extendedSnippet) {
        step.snippet = extendedSnippet;
      } else if (issue.snippet) {
        step.snippet = issue.snippet;
      }
    } else if (issue.snippet) {
      step.snippet = issue.snippet;
    }

    if (fixSuggestion) {
      step.suggestion = {
        after: fixSuggestion,
        reason: `Fix ${issue.category} issue`,
      };
    }

    steps.push(step);
  }

  return steps;
}

// ============================================================================
// FILE CONTEXT BUILDING
// ============================================================================

/**
 * Extract exports from file content
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];
  const exportRegex = /export\s+(?:const|function|class|type|interface|enum)\s+(\w+)/g;
  const namedExportRegex = /export\s*\{([^}]+)\}/g;

  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    if (match[1]) exports.push(match[1]);
  }
  while ((match = namedExportRegex.exec(content)) !== null) {
    if (match[1]) {
      const names = match[1].split(',').map(
        (s) =>
          s
            .trim()
            .split(/\s+as\s+/)[0]
            ?.trim() ?? '',
      );
      exports.push(...names.filter((n) => n && n !== 'type'));
    }
  }

  return [...new Set(exports)];
}

/**
 * Extract imports from file content
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex =
    /import\s+(?:type\s+)?(?:\{[^}]*\}|[\w*]+)?\s*(?:,\s*\{[^}]*\})?\s*from\s+['"]([^'"]+)['"]/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) imports.push(match[1]);
  }

  return [...new Set(imports)];
}

/**
 * Determine file purpose from analysis
 */
function determinePurpose(file: FileAnalysis): string {
  const mainFn = file.functions.find((f) => f.isExported);
  if (mainFn) {
    return `Module (main: ${mainFn.name})`;
  }
  if (file.exports > 0) {
    return 'Module';
  }
  return 'Internal';
}

/**
 * Build file contexts from quality report
 */
function buildFileContexts(
  files: FileAnalysis[],
  fileContents: Map<string, string>,
): FileContext[] {
  return files.map((file) => {
    const content = fileContents.get(file.path) ?? '';
    const avgComplexity =
      file.functions.length > 0
        ? Math.round(
            file.functions.reduce((sum, f) => sum + f.complexity, 0) / file.functions.length,
          )
        : 0;

    return {
      path: file.relativePath || file.path,
      purpose: determinePurpose(file),
      type: file.fileType,
      metrics: {
        lines: file.lines,
        functions: file.functions.length,
        avgComplexity,
      },
      exports: extractExports(content),
      imports: extractImports(content),
    };
  });
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate AI Report from quality report
 */
export function generateAIReport(
  qualityReport: QualityReport,
  options: AIReportOptions = {},
  fileContents?: Map<string, string>,
): AIReport {
  const { maxIssues = 100 } = options;

  // Collect all issues from quality report
  const allIssues: QualityIssue[] = [];
  for (const file of qualityReport.files) {
    allIssues.push(...file.issues);
  }

  // Enrich all issues
  const enrichedIssues = allIssues.slice(0, maxIssues).map((issue) => enrichIssue(issue));

  // Build context
  const context = buildContext(qualityReport.projectRoot);

  // Calculate summary
  const summary = calculateSummary(enrichedIssues);

  // Group by priority
  const groups = groupByPriority(enrichedIssues);

  // Generate action plan (pass fileContents for extended snippets)
  const actionPlan = generateActionPlan(enrichedIssues, fileContents);

  // Extract quick wins
  const quickWins = extractQuickWins(enrichedIssues);

  // Extract hotspots
  const hotspots = extractHotspots(enrichedIssues);

  // Build file contexts for hotspot files (consistent with hotspots section)
  // Use normalized paths from hotspots to find matching files
  const hotspotPaths = new Set(hotspots.map((h) => h.file));
  const filesWithIssues = qualityReport.files
    .filter((f) => {
      const normalizedPath = f.relativePath || f.path;
      // Check if this file is in hotspots (by normalized path)
      return (
        hotspotPaths.has(normalizedPath) ||
        hotspotPaths.has(normalizedPath.replace(/^.*?\/src\//, 'src/'))
      );
    })
    .sort((a, b) => {
      // Sort by hotspot order (issue count)
      const aHotspot = hotspots.find(
        (h) =>
          h.file === (a.relativePath || a.path) ||
          h.file === (a.relativePath || a.path).replace(/^.*?\/src\//, 'src/'),
      );
      const bHotspot = hotspots.find(
        (h) =>
          h.file === (b.relativePath || b.path) ||
          h.file === (b.relativePath || b.path).replace(/^.*?\/src\//, 'src/'),
      );
      return (bHotspot?.issueCount ?? 0) - (aHotspot?.issueCount ?? 0);
    });

  const fileContexts = fileContents ? buildFileContexts(filesWithIssues, fileContents) : [];

  // Get git info
  const git = getGitInfo(qualityReport.projectRoot);

  // Find AI rules files
  const aiRules = findAIRulesFiles(qualityReport.projectRoot);

  // Determine next action
  const nextAction = determineNextAction(summary, aiRules);

  // Generate do-not rules
  const doNot = generateDoNotRules(summary);

  const report: AIReport = {
    meta: {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      generatedBy: 'krolik-cli',
    },
    context,
    summary,
    groups,
    actionPlan,
    quickWins,
    hotspots,
    fileContexts,
    nextAction,
    doNot,
    // Conditionally add optional properties (exactOptionalPropertyTypes)
    ...(git && { git }),
    ...(aiRules.length > 0 && { aiRules }),
  };

  return report;
}

/**
 * Generate AI Report from quality analysis
 */
export async function generateAIReportFromAnalysis(
  projectRoot: string,
  options: AIReportOptions = {},
): Promise<AIReport> {
  // Import analyze function
  const { analyzeQuality } = await import('../analyze');

  // Run quality analysis - build options object conditionally
  const qualityOptions: { path?: string; includeTests: boolean } = {
    includeTests: false,
  };
  if (options.path) {
    qualityOptions.path = options.path;
  }

  const { report, fileContents } = await analyzeQuality(projectRoot, qualityOptions);

  return generateAIReport(report, options, fileContents);
}
