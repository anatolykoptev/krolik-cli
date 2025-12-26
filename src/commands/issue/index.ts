/**
 * @module commands/issue
 * @description GitHub issue parsing command
 *
 * Fetches and parses GitHub issues to extract structured information:
 * - Checklist items ([ ] and [x])
 * - Mentioned file paths
 * - Code blocks
 * - Priority detection from labels and body
 */

import { getIssue, isGhAuthenticated, isGhAvailable, sanitizeIssueNumber } from '../../lib';
import type { CommandContext, OutputFormat } from '../../types';
import { formatAI, formatJson, formatMarkdown, printIssue } from './output';
import { parseIssue } from './parser';

/**
 * Issue command options
 */
export interface IssueOptions {
  /** Issue URL (alternative to number) */
  url?: string;
  /** Issue number */
  number?: number;
  /** Output format */
  format?: OutputFormat;
}

/**
 * Extract issue number from GitHub URL
 * Supports formats:
 * - https://github.com/owner/repo/issues/123
 * - github.com/owner/repo/issues/123
 */
function extractIssueNumberFromUrl(url: string): number | null {
  const patterns = [
    /github\.com\/[^/]+\/[^/]+\/issues\/(\d+)/i,
    /github\.com\/[^/]+\/[^/]+\/pull\/(\d+)/i, // Also support PR URLs
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return sanitizeIssueNumber(match[1]);
    }
  }

  return null;
}

/**
 * Run issue command
 */
export async function runIssue(context: CommandContext & { options: IssueOptions }): Promise<void> {
  const { config, logger, options } = context;
  const projectRoot = config.projectRoot;
  const format = options.format ?? 'ai';

  // Determine issue number from options
  let issueNumber: number | null = null;

  // Validate issue number from options using sanitizeIssueNumber
  if (options.number !== undefined) {
    issueNumber = sanitizeIssueNumber(options.number);
    if (issueNumber === null) {
      const errorMsg = `Invalid issue number: ${options.number}. Must be a positive integer less than 1,000,000.`;
      if (format === 'ai') {
        console.log(`<issue-error>${errorMsg}</issue-error>`);
      } else if (format === 'json') {
        console.log(JSON.stringify({ error: errorMsg }, null, 2));
      } else {
        logger.error(errorMsg);
      }
      return;
    }
  }

  if (issueNumber === null && options.url) {
    const extracted = extractIssueNumberFromUrl(options.url);
    if (extracted) {
      issueNumber = extracted;
    } else {
      const errorMsg = 'Could not extract issue number from URL';
      if (format === 'ai') {
        console.log(`<issue-error>${errorMsg}</issue-error>`);
      } else if (format === 'json') {
        console.log(JSON.stringify({ error: errorMsg }, null, 2));
      } else {
        logger.error(errorMsg);
      }
      return;
    }
  }

  if (issueNumber === null) {
    const errorMsg = 'Issue number is required. Use: krolik issue 123 or krolik issue --url <url>';
    if (format === 'ai') {
      console.log(`<issue-error>${errorMsg}</issue-error>`);
    } else if (format === 'json') {
      console.log(JSON.stringify({ error: errorMsg }, null, 2));
    } else {
      logger.error(errorMsg);
    }
    return;
  }

  // Check gh CLI availability
  if (!isGhAvailable()) {
    const errorMsg = 'GitHub CLI (gh) is not installed. Install from: https://cli.github.com/';
    if (format === 'ai') {
      console.log(`<issue-error tool="gh" status="not-installed">${errorMsg}</issue-error>`);
    } else if (format === 'json') {
      console.log(JSON.stringify({ error: errorMsg, tool: 'gh' }, null, 2));
    } else {
      logger.error(errorMsg);
    }
    return;
  }

  // Check gh authentication
  if (!isGhAuthenticated()) {
    const errorMsg = 'Not authenticated with GitHub. Run: gh auth login';
    if (format === 'ai') {
      console.log(`<issue-error tool="gh" status="not-authenticated">${errorMsg}</issue-error>`);
    } else if (format === 'json') {
      console.log(JSON.stringify({ error: errorMsg, tool: 'gh' }, null, 2));
    } else {
      logger.error(errorMsg);
    }
    return;
  }

  // Fetch issue from GitHub
  const issue = getIssue(issueNumber, projectRoot);

  if (!issue) {
    const errorMsg = `Could not fetch issue #${issueNumber}. Check if the issue exists and you have access.`;
    if (format === 'ai') {
      console.log(`<issue-error number="${issueNumber}">${errorMsg}</issue-error>`);
    } else if (format === 'json') {
      console.log(JSON.stringify({ error: errorMsg, number: issueNumber }, null, 2));
    } else {
      logger.error(errorMsg);
    }
    return;
  }

  // Parse issue body for structured data
  const parsedIssue = parseIssue(issue);

  // Output based on format
  if (format === 'json') {
    console.log(formatJson(parsedIssue));
    return;
  }

  if (format === 'markdown') {
    console.log(formatMarkdown(parsedIssue));
    return;
  }

  if (format === 'text') {
    printIssue(parsedIssue, logger);
    return;
  }

  // Default: AI-friendly XML format
  console.log(formatAI(parsedIssue));
}

// Re-export types and parser functions for external use
export type { ChecklistItem, CodeBlock, ParsedIssue, Priority } from './parser';
export { extractCodeBlocks, extractMentionedFiles, parseChecklist, parseIssue } from './parser';
