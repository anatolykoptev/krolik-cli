/**
 * @module mcp/handlers/fix
 * @description Handler for krolik_fix tool
 */

import { runKrolik, sanitizeFeatureName, escapeShellArg, TIMEOUT_60S } from './utils';
import { withProjectDetection } from './projects';

const VALID_CATEGORIES = ['lint', 'type-safety', 'complexity', 'hardcoded', 'srp'];

export function handleFix(args: Record<string, unknown>, workspaceRoot: string): string {
  // Validate inputs before project detection
  const flagParts: string[] = [];

  if (args.dryRun) {
    flagParts.push('--dry-run');
  }

  if (args.safe) {
    flagParts.push('--safe');
  }

  if (args.path) {
    const pathVal = sanitizeFeatureName(args.path);
    if (!pathVal) {
      return 'Error: Invalid path. Only alphanumeric, hyphens, underscores, dots allowed.';
    }
    flagParts.push(`--path=${escapeShellArg(pathVal)}`);
  }

  if (args.category) {
    if (typeof args.category !== 'string' || !VALID_CATEGORIES.includes(args.category)) {
      return `Error: Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`;
    }
    flagParts.push(`--category=${args.category}`);
  }

  return withProjectDetection(args, workspaceRoot, (projectPath) => {
    return runKrolik(`fix ${flagParts.join(' ')}`, projectPath, TIMEOUT_60S);
  });
}
