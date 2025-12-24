/**
 * @module mcp/handlers/refactor
 * @description Handler for krolik_refactor tool
 */

import { runKrolik, sanitizeFeatureName, escapeShellArg, TIMEOUT_60S } from './utils';
import { withProjectDetection } from './projects';

export function handleRefactor(args: Record<string, unknown>, workspaceRoot: string): string {
  const flagParts: string[] = [];

  // Path option
  if (args.path) {
    const pathVal = sanitizeFeatureName(args.path);
    if (!pathVal) {
      return 'Error: Invalid path. Only alphanumeric, hyphens, underscores, dots allowed.';
    }
    flagParts.push(`--path=${escapeShellArg(pathVal)}`);
  }

  // Package option (for monorepo)
  if (args.package) {
    const pkgVal = sanitizeFeatureName(args.package);
    if (!pkgVal) {
      return 'Error: Invalid package name.';
    }
    flagParts.push(`--package=${escapeShellArg(pkgVal)}`);
  }

  // Boolean flags
  if (args.allPackages) flagParts.push('--all-packages');
  if (args.duplicatesOnly) flagParts.push('--duplicates-only');
  if (args.typesOnly) flagParts.push('--types-only');
  if (args.includeTypes) flagParts.push('--include-types');
  if (args.structureOnly) flagParts.push('--structure-only');
  if (args.dryRun) flagParts.push('--dry-run');
  if (args.apply) flagParts.push('--apply');
  if (args.fixTypes) flagParts.push('--fix-types');

  // Always use AI-native output for MCP
  flagParts.push('--ai');

  return withProjectDetection(args, workspaceRoot, (projectPath) => {
    return runKrolik(`refactor ${flagParts.join(' ')}`, projectPath, TIMEOUT_60S);
  });
}
