/**
 * @module commands/review
 * @description AI-assisted code review command
 */

import { detectLibraries } from '@/lib/integrations/context7';
import { searchDocs } from '@/lib/storage/docs';
import { escapeXml } from '../../lib';
import type {
  CommandContext,
  DocReference,
  FileChange,
  OutputFormat,
  ReviewIssue,
  ReviewResult,
} from '../../types';
import { buildAgentContext, formatContextForPrompt } from '../agent/context';
import { findAgentsPath, loadAgentByName } from '../agent/loader';
import {
  getChangedFiles,
  getFileChanges,
  getPRInfo,
  getReviewBranches,
  getStagedChanges,
} from './diff';
import { formatAI, formatJson, formatMarkdown, printReview } from './output';
import { analyzeAddedLines } from './patterns';
import { assessRisk, detectAffectedFeatures, needsDocs, needsTests } from './risk';

/**
 * Review command options
 */
export interface ReviewOptions {
  pr?: string;
  staged?: boolean;
  base?: string;
  format?: OutputFormat;
  verbose?: boolean;
  /** Run security, performance, and architecture agents */
  withAgents?: boolean;
  /** Specific agents to run (comma-separated) */
  agents?: string;
}

/**
 * Generate review for changes
 */
export function generateReview(
  files: FileChange[],
  options: {
    title: string;
    baseBranch: string;
    headBranch: string;
    description?: string;
    staged?: boolean;
    cwd?: string;
  },
): ReviewResult {
  const issues: ReviewIssue[] = [];

  // Analyze each file
  for (const file of files) {
    if (file.binary || file.status === 'deleted') continue;
    if (!file.path.match(/\.(ts|tsx|js|jsx)$/)) continue;

    const diff = getFileChanges(file.path, {
      ...(options.staged ? { staged: options.staged } : {}),
      base: options.baseBranch,
      head: options.headBranch,
      ...(options.cwd ? { cwd: options.cwd } : {}),
    });

    const fileIssues = analyzeAddedLines(diff, file.path);
    issues.push(...fileIssues);
  }

  const affectedFeatures = detectAffectedFeatures(files);

  // Find relevant documentation from cached library docs
  const docsReferences = findRelevantDocs(issues, options.cwd);

  return {
    title: options.title,
    description: options.description || '',
    baseBranch: options.baseBranch,
    headBranch: options.headBranch,
    files,
    issues,
    affectedFeatures,
    summary: {
      totalFiles: files.length,
      additions: files.reduce((sum, f) => sum + f.additions, 0),
      deletions: files.reduce((sum, f) => sum + f.deletions, 0),
      riskLevel: assessRisk(files, issues),
      testsRequired: needsTests(files),
      docsRequired: needsDocs(files),
    },
    ...(docsReferences.length > 0 ? { docsReferences } : {}),
  };
}

/**
 * Framework names that support best practices documentation
 */
const FRAMEWORK_NAMES = ['next.js', 'react', 'express', 'fastify', 'hono', 'prisma', 'trpc'];

/**
 * Find relevant documentation from cached library docs based on review issues
 */
function findRelevantDocs(issues: ReviewIssue[], projectRoot?: string): DocReference[] {
  if (!projectRoot || issues.length === 0) {
    return [];
  }

  try {
    // Detect libraries in the project
    const detectedLibs = detectLibraries(projectRoot);

    // Find the primary framework
    const framework = detectedLibs.find((lib) => FRAMEWORK_NAMES.includes(lib.name));

    if (!framework || !framework.isCached) {
      return [];
    }

    // Build search query from unique issue categories
    const categories = [...new Set(issues.map((i) => i.category))];
    const docsQuery = categories.slice(0, 3).join(' ');

    // Search for relevant documentation
    const results = searchDocs({
      query: docsQuery,
      library: framework.name,
      limit: 3,
    });

    // Map to DocReference format
    return results.map((r) => ({
      library: r.libraryName,
      title: r.section.title,
      snippet: r.section.content.slice(0, 200) + (r.section.content.length > 200 ? '...' : ''),
    }));
  } catch {
    // Silently fail if docs cache is not available
    return [];
  }
}

/**
 * Run review command
 */
export async function runReview(ctx: CommandContext & { options: ReviewOptions }): Promise<void> {
  const { config, logger, options } = ctx;
  const cwd = config.projectRoot;

  let title: string;
  let description = '';
  let baseBranch: string;
  let headBranch: string;
  let files: FileChange[];

  if (options.pr) {
    // Review specific PR
    const prNumber = Number.parseInt(options.pr, 10);
    const prInfo = getPRInfo(prNumber, cwd);

    if (!prInfo) {
      logger.error(`Failed to fetch PR #${prNumber}`);
      return;
    }

    title = prInfo.title;
    description = prInfo.description;
    baseBranch = prInfo.baseBranch;
    headBranch = prInfo.headBranch;
    files = getChangedFiles(baseBranch, headBranch, cwd);
  } else if (options.staged) {
    // Review staged changes
    title = 'Staged Changes Review';
    baseBranch = 'HEAD';
    headBranch = 'staged';
    files = getStagedChanges(cwd);
  } else {
    // Review current branch vs main
    const branches = getReviewBranches(cwd);
    baseBranch = options.base || branches.base;
    headBranch = branches.head;
    title = `Review: ${headBranch}`;
    files = getChangedFiles(baseBranch, headBranch, cwd);
  }

  if (files.length === 0) {
    logger.warn('No changes to review');
    return;
  }

  const review = generateReview(files, {
    title,
    description,
    baseBranch,
    headBranch,
    ...(options.staged ? { staged: options.staged } : {}),
    cwd,
  });

  const format = options.format ?? 'ai';

  if (format === 'json') {
    console.log(formatJson(review));
    return;
  }

  if (format === 'markdown') {
    console.log(formatMarkdown(review));
    return;
  }

  if (format === 'text') {
    printReview(review, logger);
    return;
  }

  // Default: AI-friendly XML
  console.log(formatAI(review));

  // Run agents if requested
  if (options.withAgents || options.agents) {
    await runReviewAgents(cwd, review, options, logger);
  }
}

/**
 * Default agents for --with-agents flag
 */
const DEFAULT_REVIEW_AGENTS = ['security-auditor', 'performance-engineer', 'backend-architect'];

/**
 * Run agents for code review
 */
async function runReviewAgents(
  projectRoot: string,
  review: ReviewResult,
  options: ReviewOptions,
  logger: CommandContext['logger'],
): Promise<void> {
  const agentsPath = findAgentsPath(projectRoot);

  if (!agentsPath) {
    logger.warn('Agents not installed. Run: krolik setup --agents');
    return;
  }

  // Determine which agents to run
  const agentNames = options.agents
    ? options.agents.split(',').map((a) => a.trim())
    : DEFAULT_REVIEW_AGENTS;

  console.log('\n<agent-review>');
  console.log(`  <agents-requested>${agentNames.join(', ')}</agents-requested>`);

  // Build context once for all agents
  const context = await buildAgentContext(projectRoot, {
    includeSchema: true,
    includeRoutes: true,
    includeGit: true,
  });
  const contextPrompt = formatContextForPrompt(context);

  // Build diff context from review
  const diffContext = buildDiffContext(review);

  for (const agentName of agentNames) {
    const agent = loadAgentByName(agentsPath, agentName);

    if (!agent) {
      console.log(`  <agent-error name="${agentName}">Agent not found</agent-error>`);
      continue;
    }

    const fullPrompt = `${agent.content}

## Code Review Context

${diffContext}

${contextPrompt}

Please analyze the code changes and provide your specialized review findings.`;

    console.log(`  <agent-execution name="${agent.name}" category="${agent.category}">`);
    console.log(`    <description>${escapeXml(agent.description)}</description>`);
    if (agent.model) {
      console.log(`    <model>${agent.model}</model>`);
    }
    console.log('    <prompt>');
    console.log(escapeXml(fullPrompt));
    console.log('    </prompt>');
    console.log('  </agent-execution>');
  }

  console.log('</agent-review>');
}

/**
 * Build diff context from review result
 */
function buildDiffContext(review: ReviewResult): string {
  const lines: string[] = [];

  lines.push(`### Review: ${review.title}`);
  lines.push(`Branch: ${review.headBranch} → ${review.baseBranch}`);
  lines.push(`Files changed: ${review.files.length}`);
  lines.push(`Additions: +${review.summary.additions}, Deletions: -${review.summary.deletions}`);
  lines.push(`Risk level: ${review.summary.riskLevel}`);
  lines.push('');

  if (review.issues.length > 0) {
    lines.push('### Issues Found:');
    for (const issue of review.issues.slice(0, 10)) {
      lines.push(`- [${issue.severity}] ${issue.file}:${issue.line} - ${issue.message}`);
    }
    if (review.issues.length > 10) {
      lines.push(`... and ${review.issues.length - 10} more issues`);
    }
    lines.push('');
  }

  lines.push('### Changed Files:');
  for (const file of review.files.slice(0, 20)) {
    lines.push(`- ${file.status}: ${file.path} (+${file.additions}/-${file.deletions})`);
  }
  if (review.files.length > 20) {
    lines.push(`... and ${review.files.length - 20} more files`);
  }

  return lines.join('\n');
}

export type { ReviewPattern } from './patterns';
// Re-export for external use
export { analyzeAddedLines, checkPatterns } from './patterns';
export type { RiskLevel } from './risk';
export { assessRisk, detectAffectedFeatures, needsDocs, needsTests } from './risk';
