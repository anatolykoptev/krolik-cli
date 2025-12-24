/**
 * @module mcp/handlers/audit
 * @description Handler for krolik_audit tool
 */

import { runKrolik, sanitizeFeatureName, escapeShellArg, TIMEOUT_60S } from './utils';

export function handleAudit(args: Record<string, unknown>, projectRoot: string): string {
  const flagParts: string[] = [];

  // Security: Validate path
  if (args.path) {
    const pathVal = sanitizeFeatureName(args.path);
    if (!pathVal) {
      return 'Error: Invalid path. Only alphanumeric, hyphens, underscores, dots allowed.';
    }
    flagParts.push(`--path=${escapeShellArg(pathVal)}`);
  }

  return runKrolik(`audit ${flagParts.join(' ')}`, projectRoot, TIMEOUT_60S);
}
