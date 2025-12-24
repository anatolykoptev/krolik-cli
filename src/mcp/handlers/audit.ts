/**
 * @module mcp/handlers/audit
 * @description Handler for krolik_audit tool
 */

import { runKrolik, sanitizeFeatureName, escapeShellArg, TIMEOUT_60S } from './utils';
import { withProjectDetection } from './projects';

export function handleAudit(args: Record<string, unknown>, workspaceRoot: string): string {
  // Validate path before project detection
  const flagParts: string[] = [];

  if (args.path) {
    const pathVal = sanitizeFeatureName(args.path);
    if (!pathVal) {
      return 'Error: Invalid path. Only alphanumeric, hyphens, underscores, dots allowed.';
    }
    flagParts.push(`--path=${escapeShellArg(pathVal)}`);
  }

  return withProjectDetection(args, workspaceRoot, (projectPath) => {
    return runKrolik(`audit ${flagParts.join(' ')}`, projectPath, TIMEOUT_60S);
  });
}
