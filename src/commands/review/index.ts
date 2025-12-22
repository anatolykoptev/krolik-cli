/**
 * @module commands/review
 * @description AI-assisted code review command
 */

import type { CommandContext, ReviewResult, FileChange, ReviewIssue } from '../../types';
import { getChangedFiles, getStagedChanges, getPRInfo, getFileChanges, getReviewBranches } from './diff';
import { analyzeAddedLines } from './patterns';
import { assessRisk, needsTests, needsDocs, detectAffectedFeatures } from './risk';
import { printReview, formatJson, formatMarkdown } from './output';

/**
 * Review command options
 */
export interface ReviewOptions {
  pr?: string;
  staged?: boolean;
  base?: string;
  json?: boolean;
  markdown?: boolean;
  verbose?: boolean;
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
      staged: options.staged,
      base: options.baseBranch,
      head: options.headBranch,
      cwd: options.cwd,
    });

    const fileIssues = analyzeAddedLines(diff, file.path);
    issues.push(...fileIssues);
  }

  const affectedFeatures = detectAffectedFeatures(files);

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
  };
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
    staged: options.staged,
    cwd,
  });

  if (options.json) {
    console.log(formatJson(review));
    return;
  }

  if (options.markdown) {
    console.log(formatMarkdown(review));
    return;
  }

  printReview(review, logger);
}

// Re-export for external use
export { analyzeAddedLines, checkPatterns } from './patterns';
export { assessRisk, needsTests, needsDocs, detectAffectedFeatures } from './risk';
export type { ReviewPattern } from './patterns';
export type { RiskLevel } from './risk';
