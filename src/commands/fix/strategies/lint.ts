/**
 * @module commands/fix/strategies/lint
 * @description Smart fix strategies for lint issues
 *
 * Context-aware fixing:
 * - Skips console.log in CLI output files
 * - Skips console in test files
 * - Only removes actual debugging statements
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { QualityIssue } from '../../quality/types';
import type { FixOperation, FixStrategy } from '../types';
import { buildFixContext, shouldSkipConsoleFix, type FixContext } from '../context';

// Cache for fix contexts
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
 * Fix console.log statements (with smart detection)
 */
function fixConsole(
  issue: QualityIssue,
  content: string,
  context: FixContext,
): FixOperation | null {
  if (!issue.line) return null;

  // Smart check: should we skip this console?
  if (shouldSkipConsoleFix(context, content, issue.line)) {
    return null; // Skip - this is intentional output
  }

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];

  if (!line) return null;

  // Check if it's a standalone console statement
  const trimmed = line.trim();
  if (trimmed.startsWith('console.')) {
    // Check if it ends with semicolon or is complete
    if (trimmed.endsWith(';') || trimmed.endsWith(')')) {
      return {
        action: 'delete-line',
        file: issue.file,
        line: issue.line,
        oldCode: line,
      };
    }
  }

  // If console is part of larger expression, comment it out
  return {
    action: 'replace-line',
    file: issue.file,
    line: issue.line,
    oldCode: line,
    newCode: line.replace(/console\.\w+\([^)]*\);?/, '/* console removed */'),
  };
}

/**
 * Fix debugger statements (always safe to remove)
 */
function fixDebugger(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];

  if (!line) return null;

  const trimmed = line.trim();

  // If line is just "debugger;", delete it
  if (trimmed === 'debugger;' || trimmed === 'debugger') {
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  // If debugger is part of larger line, remove just the debugger
  return {
    action: 'replace-line',
    file: issue.file,
    line: issue.line,
    oldCode: line,
    newCode: line.replace(/\bdebugger;?\s*/g, ''),
  };
}

/**
 * Fix alert statements
 */
function fixAlert(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];

  if (!line) return null;

  const trimmed = line.trim();

  // If line is just alert(), delete it
  if (trimmed.startsWith('alert(') && (trimmed.endsWith(');') || trimmed.endsWith(')'))) {
    return {
      action: 'delete-line',
      file: issue.file,
      line: issue.line,
      oldCode: line,
    };
  }

  return null;
}

/**
 * Smart lint fix strategy
 */
export const lintStrategy: FixStrategy = {
  categories: ['lint'],

  canFix(issue: QualityIssue, content: string): boolean {
    const { message } = issue;
    const lowerMessage = message.toLowerCase();

    // Debugger and alert are always fixable
    if (lowerMessage.includes('debugger') || lowerMessage.includes('alert')) {
      return true;
    }

    // For console, we need to check context
    if (lowerMessage.includes('console')) {
      // Get project root from file path (go up until we find package.json)
      const projectRoot = findProjectRoot(issue.file);
      const context = getContext(issue.file, content, projectRoot);

      // Skip if this is intentional output
      if (shouldSkipConsoleFix(context, content, issue.line || 0)) {
        return false;
      }

      return true;
    }

    return false;
  },

  generateFix(issue: QualityIssue, content: string): FixOperation | null {
    const { message } = issue;
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('debugger')) {
      return fixDebugger(issue, content);
    }

    if (lowerMessage.includes('alert')) {
      return fixAlert(issue, content);
    }

    if (lowerMessage.includes('console')) {
      const projectRoot = findProjectRoot(issue.file);
      const context = getContext(issue.file, content, projectRoot);
      return fixConsole(issue, content, context);
    }

    return null;
  },
};

/**
 * Find project root by looking for package.json
 */
function findProjectRoot(filePath: string): string {
  let dir = path.dirname(filePath);
  const maxDepth = 10;
  let depth = 0;

  while (depth < maxDepth) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
    depth++;
  }

  return path.dirname(filePath);
}
