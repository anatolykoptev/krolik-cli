/**
 * @module mcp/handlers/review
 * @description Handler for krolik_review tool
 */

import { runKrolik, sanitizeIssueNumber, TIMEOUT_60S } from './utils';

export function handleReview(args: Record<string, unknown>, projectRoot: string): string {
  let flags = '';

  if (args.staged) {
    flags += ' --staged';
  }

  // Security: Validate PR number
  if (args.pr) {
    const pr = sanitizeIssueNumber(args.pr);
    if (!pr) {
      return 'Error: Invalid PR number. Must be a positive integer.';
    }
    flags += ` --pr=${pr}`;
  }

  return runKrolik(`review ${flags}`, projectRoot, TIMEOUT_60S);
}
