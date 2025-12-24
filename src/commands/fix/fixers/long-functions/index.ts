/**
 * @module commands/fix/fixers/long-functions
 * @description Long functions fixer
 *
 * Detects functions that are too long and need splitting.
 */

import type { Fixer, QualityIssue, FixOperation } from '../../core/types';
import { createFixerMetadata } from '../../core/registry';

export const metadata = createFixerMetadata('long-functions', 'Long Functions', 'complexity', {
  description: 'Split long functions into smaller ones',
  difficulty: 'risky',
  cliFlag: '--fix-long-functions',
  tags: ['risky', 'refactoring', 'complexity'],
});

const MAX_FUNCTION_LINES = 50;

interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  lines: number;
}

function findFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split('\n');

  let currentFunction: FunctionInfo | null = null;
  let braceCount = 0;
  let functionStartBrace = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    // Detect function start
    const funcMatch = line.match(/(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*(?:=|:)\s*(?:async\s*)?\([^)]*\)\s*(?:=>|{))/);

    if (funcMatch && !currentFunction) {
      const name = funcMatch[1] || funcMatch[2] || funcMatch[3] || 'anonymous';
      currentFunction = {
        name,
        startLine: i + 1,
        endLine: i + 1,
        lines: 0,
      };
      functionStartBrace = braceCount;
    }

    // Count braces
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }

    // Function end
    if (currentFunction && braceCount <= functionStartBrace && line.includes('}')) {
      currentFunction.endLine = i + 1;
      currentFunction.lines = currentFunction.endLine - currentFunction.startLine + 1;
      functions.push(currentFunction);
      currentFunction = null;
    }
  }

  return functions;
}

function analyzeLongFunctions(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Skip test files
  if (file.includes('.test.') || file.includes('.spec.')) {
    return issues;
  }

  const functions = findFunctions(content);

  for (const func of functions) {
    if (func.lines > MAX_FUNCTION_LINES) {
      issues.push({
        file,
        line: func.startLine,
        severity: func.lines > MAX_FUNCTION_LINES * 2 ? 'error' : 'warning',
        category: 'complexity',
        message: `Function '${func.name}' is too long: ${func.lines} lines (max: ${MAX_FUNCTION_LINES})`,
        suggestion: 'Split into smaller functions with single responsibility',
        snippet: `${func.name}(): ${func.lines} lines`,
        fixerId: 'long-functions',
      });
    }
  }

  return issues;
}

function fixLongFunctionIssue(_issue: QualityIssue, _content: string): FixOperation | null {
  // Long function fixes require AST analysis and are risky
  // Return null for now - this would need AI assistance or manual review
  return null;
}

export const longFunctionsFixer: Fixer = {
  metadata,
  analyze: analyzeLongFunctions,
  fix: fixLongFunctionIssue,
};
