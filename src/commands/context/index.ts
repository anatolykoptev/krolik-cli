/**
 * @module commands/context
 * @description AI context generation command
 */

import type { CommandContext, ContextResult } from '../../types';
import { getIssue } from '../../lib/github';
import { detectDomains, findRelatedFiles, getApproaches, generateChecklist, getRelevantDocs } from './domains';
import { printContext, formatJson, formatMarkdown } from './output';

/**
 * Context command options
 */
export interface ContextOptions {
  issue?: string;
  feature?: string;
  file?: string;
  json?: boolean;
  markdown?: boolean;
  verbose?: boolean;
}

/**
 * Generate task context
 */
export function generateContext(
  task: string,
  projectRoot: string,
  issueData?: { number: number; title: string; body: string; labels: string[] },
): ContextResult {
  const searchText = issueData ? `${issueData.title} ${issueData.body}` : task;
  const domains = detectDomains(searchText);
  const relatedFiles = findRelatedFiles(domains, projectRoot);
  const approach = getApproaches(domains);

  return {
    task: issueData ? issueData.title : task,
    domains,
    relatedFiles,
    approach,
    issue: issueData,
  };
}

/**
 * Run context command
 */
export async function runContext(ctx: CommandContext & { options: ContextOptions }): Promise<void> {
  const { config, logger, options } = ctx;

  let task = options.feature || options.file || 'General development context';
  let issueData: ContextResult['issue'] | undefined;

  // Fetch issue if provided
  if (options.issue) {
    const issueNum = Number.parseInt(options.issue, 10);
    if (!Number.isNaN(issueNum)) {
      const issue = getIssue(issueNum, config.projectRoot);
      if (issue) {
        issueData = {
          number: issue.number,
          title: issue.title,
          body: issue.body,
          labels: issue.labels,
        };
        task = issue.title;
      } else {
        logger.warn(`Could not fetch issue #${issueNum}. Check gh auth status.`);
        task = `Issue #${issueNum}`;
      }
    }
  }

  const result = generateContext(task, config.projectRoot, issueData);

  if (options.json) {
    console.log(formatJson(result));
    return;
  }

  if (options.markdown) {
    console.log(formatMarkdown(result));
    return;
  }

  printContext(result, logger, options.verbose);
}

// Re-export for external use
export { detectDomains, findRelatedFiles, getApproaches, generateChecklist } from './domains';
