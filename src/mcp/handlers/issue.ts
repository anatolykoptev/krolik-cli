/**
 * @module mcp/handlers/issue
 * @description Handler for krolik_issue tool
 */

import { runKrolik, sanitizeIssueNumber } from './utils';

export function handleIssue(args: Record<string, unknown>, projectRoot: string): string {
  // Security: Validate issue number (required field)
  const issueNum = sanitizeIssueNumber(args.number);
  if (!issueNum) {
    return 'Error: Invalid issue number. Must be a positive integer.';
  }

  return runKrolik(`issue ${issueNum}`, projectRoot);
}
