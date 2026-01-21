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

import { sanitizeIssueNumber } from '../../lib/@security';
import { getIssue, isGhAuthenticated, isGhAvailable } from '../../lib/@vcs';
import type { CommandContext, OutputFormat } from '../../types/commands/base';
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
 * Handle error output based on format
 */
function handleError(
  message: string,
  format: string,
  logger: any,
  details: Record<string, any> = {},
): void {
  if (format === 'ai') {
    const attrs = Object.entries(details)
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    console.log(`<issue-error${attrs ? ` ${attrs}` : ''}>${message}</issue-error>`);
  } else if (format === 'json') {
    console.log(JSON.stringify({ error: message, ...details }, null, 2));
  } else {
    logger.error(message);
  }
}

/**
 * Resolve issue number from options
 */
function resolveIssueNumber(options: IssueOptions): number | null {
  if (options.number !== undefined) {
    return sanitizeIssueNumber(options.number);
  }

  if (options.url) {
    return extractIssueNumberFromUrl(options.url);
  }

  return null;
}

/**
 * Check if dependencies are satisfied
 */
function checkDependencies(format: string, logger: any): boolean {
  if (!isGhAvailable()) {
    handleError(
      'GitHub CLI (gh) is not installed. Install from: https://cli.github.com/',
      format,
      logger,
      { tool: 'gh', status: 'not-installed' },
    );
    return false;
  }

  if (!isGhAuthenticated()) {
    handleError('Not authenticated with GitHub. Run: gh auth login', format, logger, {
      tool: 'gh',
      status: 'not-authenticated',
    });
    return false;
  }

  return true;
}

/**
 * Run issue command
 */
export async function runIssue(context: CommandContext & { options: IssueOptions }): Promise<void> {
  const { config, logger, options } = context;
  const projectRoot = config.projectRoot;
  const format = options.format ?? 'ai';

  // Validate issue number input (before checking everything else)
  if (options.number !== undefined && sanitizeIssueNumber(options.number) === null) {
    handleError(
      `Invalid issue number: ${options.number}. Must be a positive integer less than 1,000,000.`,
      format,
      logger,
    );
    return;
  }

  const issueNumber = resolveIssueNumber(options);

  if (issueNumber === null) {
    // If URL was provided but failed to parse
    if (options.url) {
      handleError('Could not extract issue number from URL', format, logger);
      return;
    }

    // No number or URL provided
    handleError(
      'Issue number is required. Use: krolik issue 123 or krolik issue --url <url>',
      format,
      logger,
    );
    return;
  }

  // Check gh CLI dependencies
  if (!checkDependencies(format, logger)) {
    return;
  }

  // Fetch issue from GitHub
  const issue = getIssue(issueNumber, projectRoot);

  if (!issue) {
    handleError(
      `Could not fetch issue #${issueNumber}. Check if the issue exists and you have access.`,
      format,
      logger,
      { number: issueNumber },
    );
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
