/**
 * @module commands/audit/suggestions/lint-suggestions
 * @description Lint issue suggestion generators
 *
 * Generates suggestions for console.log, debugger, and other lint issues.
 */

import type { Suggestion, SuggestionContext } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Patterns that indicate console.log usage
 */
const CONSOLE_PATTERNS = [
  /\bconsole\s*\.\s*log\b/,
  /\bconsole\s*\.\s*info\b/,
  /\bconsole\s*\.\s*warn\b/,
  /\bconsole\s*\.\s*error\b/,
  /\bconsole\s*\.\s*debug\b/,
  /\bconsole\s*\.\s*trace\b/,
];

/**
 * Patterns for debugger statements
 */
const DEBUGGER_PATTERN = /\bdebugger\s*;?/;

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate suggestion for lint issues (console.log, debugger)
 */
export function generateLintSuggestion(context: SuggestionContext): Suggestion | null {
  const { issue, lineContent } = context;
  const messageLower = issue.message.toLowerCase();

  // Handle console.log removal
  if (messageLower.includes('console')) {
    return generateConsoleRemovalSuggestion(lineContent);
  }

  // Handle debugger removal
  if (messageLower.includes('debugger')) {
    return generateDebuggerRemovalSuggestion(lineContent);
  }

  return null;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Generate suggestion for console.log removal
 */
function generateConsoleRemovalSuggestion(lineContent: string): Suggestion | null {
  // Check if line contains console statement
  const hasConsole = CONSOLE_PATTERNS.some((pattern) => pattern.test(lineContent));
  if (!hasConsole) {
    return null;
  }

  const before = lineContent.trim();

  // If the entire line is just console.log, suggest removal
  const isWholeLineConsole = /^\s*console\s*\.\s*\w+\s*\([^)]*\)\s*;?\s*$/.test(lineContent);

  if (isWholeLineConsole) {
    return {
      before,
      after: '// (line removed)',
      reasoning: 'Remove console statement from production code',
      confidence: 100,
    };
  }

  // If console is part of larger expression, wrap in conditional
  return {
    before,
    after: `// TODO: Remove console statement\n${before}`,
    reasoning: 'Console statement should be removed; adding TODO for review',
    confidence: 75,
  };
}

/**
 * Generate suggestion for debugger removal
 */
function generateDebuggerRemovalSuggestion(lineContent: string): Suggestion | null {
  if (!DEBUGGER_PATTERN.test(lineContent)) {
    return null;
  }

  const before = lineContent.trim();

  // If the entire line is just debugger, suggest removal
  const isWholeLineDebugger = /^\s*debugger\s*;?\s*$/.test(lineContent);

  if (isWholeLineDebugger) {
    return {
      before,
      after: '// (line removed)',
      reasoning: 'Remove debugger statement from production code',
      confidence: 100,
    };
  }

  // If debugger is inline with other code, just remove it
  const after = lineContent.replace(DEBUGGER_PATTERN, '').trim();
  return {
    before,
    after,
    reasoning: 'Remove inline debugger statement',
    confidence: 95,
  };
}
