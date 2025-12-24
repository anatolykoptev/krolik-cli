/**
 * @module mcp/handlers/review
 * @description Handler for krolik_review tool
 */

import { runKrolik, sanitizeIssueNumber, TIMEOUT_60S } from './utils';
import { withProjectDetection } from './projects';

export function handleReview(args: Record<string, unknown>, workspaceRoot: string): string {
  // Validate PR number before project detection
  let flags = '';

  if (args.staged) {
    flags += ' --staged';
  }

  if (args.pr) {
    const pr = sanitizeIssueNumber(args.pr);
    if (!pr) {
      return 'Error: Invalid PR number. Must be a positive integer.';
    }
    flags += ` --pr=${pr}`;
  }

  return withProjectDetection(args, workspaceRoot, (projectPath) => {
    return runKrolik(`review ${flags}`, projectPath, TIMEOUT_60S);
  });
}
