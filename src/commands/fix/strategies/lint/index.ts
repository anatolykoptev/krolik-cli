/**
 * @module commands/fix/strategies/lint
 * @description Smart fix strategy for lint issues
 *
 * Context-aware fixing:
 * - Skips console.log in CLI output files
 * - Skips console in test files
 * - Only removes actual debugging statements
 *
 * Handles:
 * - console.log/debug/etc (with smart detection)
 * - debugger statements
 * - alert statements
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { FixContext } from '../../context';
import { buildFixContext, shouldSkipConsoleFix } from '../../context';
import { containsKeyword } from '../../core';
import type { FixOperation, FixStrategy, QualityIssue } from '../../types';
import { LINT_KEYWORDS } from './constants';
import { fixAlert, fixConsole, fixDebugger } from './fixes';

// ============================================================================
// CONTEXT MANAGEMENT
// ============================================================================

/** Cache for fix contexts (cleared per-session) */
const contextCache = new Map<string, FixContext>();

/**
 * Get or build fix context for a file
 */
function getContext(filePath: string, content: string, projectRoot: string): FixContext {
  const cached = contextCache.get(filePath);
  if (cached) return cached;

  const context = buildFixContext(projectRoot, filePath, content);
  contextCache.set(filePath, context);
  return context;
}

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(filePath: string): string {
  const MAX_DEPTH = 10;
  let dir = path.dirname(filePath);

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      return dir;
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.dirname(filePath);
}

// ============================================================================
// STRATEGY
// ============================================================================

/**
 * Smart lint fix strategy
 *
 * Handles console, debugger, and alert statements with context awareness.
 */
export const lintStrategy: FixStrategy = {
  categories: ['lint'],

  canFix(issue: QualityIssue, content: string): boolean {
    const { message, file } = issue;

    // Debugger and alert are always fixable
    if (
      containsKeyword(message, LINT_KEYWORDS.DEBUGGER) ||
      containsKeyword(message, LINT_KEYWORDS.ALERT)
    ) {
      return true;
    }

    // For console, we need to check context
    if (containsKeyword(message, LINT_KEYWORDS.CONSOLE)) {
      if (!file) return false;

      const projectRoot = findProjectRoot(file);
      const context = getContext(file, content, projectRoot);

      // Skip if this is intentional output
      if (shouldSkipConsoleFix(context, content, issue.line || 0)) {
        return false;
      }

      return true;
    }

    return false;
  },

  generateFix(issue: QualityIssue, content: string): FixOperation | null {
    const { message, file } = issue;

    if (containsKeyword(message, LINT_KEYWORDS.DEBUGGER)) {
      return fixDebugger(issue, content);
    }

    if (containsKeyword(message, LINT_KEYWORDS.ALERT)) {
      return fixAlert(issue, content);
    }

    if (containsKeyword(message, LINT_KEYWORDS.CONSOLE)) {
      if (!file) return null;

      const projectRoot = findProjectRoot(file);
      const context = getContext(file, content, projectRoot);
      return fixConsole(issue, content, context);
    }

    return null;
  },
};

// Re-export for testing
export { LINT_KEYWORDS } from './constants';
export { fixAlert, fixConsole, fixDebugger } from './fixes';
