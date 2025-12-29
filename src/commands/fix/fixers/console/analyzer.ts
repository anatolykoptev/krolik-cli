/**
 * @module commands/fix/fixers/console/analyzer
 * @description Detects console.* statements in code
 */

import { isInsideLineComment, isInsideStringLine } from '../../../../lib/@ast/swc';
import type { QualityIssue } from '../../core/types';

/**
 * Console methods to detect
 */
const CONSOLE_METHODS = ['log', 'warn', 'error', 'info', 'debug', 'trace', 'dir', 'table'];

/**
 * Pattern to match console.X( calls
 */
const CONSOLE_PATTERN = new RegExp(`console\\.(${CONSOLE_METHODS.join('|')})\\s*\\(`, 'g');

/**
 * Analyze content for console statements
 */
export function analyzeConsole(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip full-line comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // Reset regex
    CONSOLE_PATTERN.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = CONSOLE_PATTERN.exec(line)) !== null) {
      // Skip if inside comment or string
      if (isInsideLineComment(line, match.index)) continue;
      if (isInsideStringLine(line, match.index)) continue;

      const method = match[1] ?? 'log';

      issues.push({
        file,
        line: i + 1,
        severity: 'warning',
        category: 'lint',
        message: `Unexpected console statement: console.${method}`,
        suggestion: 'Remove console statement before production',
        snippet: trimmed.slice(0, 60),
        fixerId: 'console',
      });
    }
  }

  return issues;
}
