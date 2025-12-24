/**
 * @module mcp/handlers/context
 * @description Handler for krolik_context tool
 */

import { runKrolik, sanitizeFeatureName, sanitizeIssueNumber, escapeShellArg, TIMEOUT_60S } from './utils';
import { withProjectDetection } from './projects';

export function handleContext(args: Record<string, unknown>, workspaceRoot: string): string {
  // Validate inputs before project detection
  const flagParts: string[] = [];

  if (args.feature) {
    const feature = sanitizeFeatureName(args.feature);
    if (!feature) {
      return 'Error: Invalid feature name. Only alphanumeric, hyphens, underscores allowed.';
    }
    flagParts.push(`--feature=${escapeShellArg(feature)}`);
  }

  if (args.issue) {
    const issue = sanitizeIssueNumber(args.issue);
    if (!issue) {
      return 'Error: Invalid issue number. Must be a positive integer.';
    }
    flagParts.push(`--issue=${issue}`);
  }

  return withProjectDetection(args, workspaceRoot, (projectPath) => {
    return runKrolik(`context ${flagParts.join(' ')}`, projectPath, TIMEOUT_60S);
  });
}
