/**
 * @module mcp/handlers/context
 * @description Handler for krolik_context tool
 */

import { runKrolik, sanitizeFeatureName, sanitizeIssueNumber, escapeShellArg, TIMEOUT_60S } from './utils';

export function handleContext(args: Record<string, unknown>, projectRoot: string): string {
  const flagParts: string[] = []; // Don't use --full by default (too slow)

  // Security: Validate and sanitize feature name
  if (args.feature) {
    const feature = sanitizeFeatureName(args.feature);
    if (!feature) {
      return 'Error: Invalid feature name. Only alphanumeric, hyphens, underscores allowed.';
    }
    flagParts.push(`--feature=${escapeShellArg(feature)}`);
  }

  // Security: Validate issue number
  if (args.issue) {
    const issue = sanitizeIssueNumber(args.issue);
    if (!issue) {
      return 'Error: Invalid issue number. Must be a positive integer.';
    }
    flagParts.push(`--issue=${issue}`);
  }

  return runKrolik(`context ${flagParts.join(' ')}`, projectRoot, TIMEOUT_60S);
}
