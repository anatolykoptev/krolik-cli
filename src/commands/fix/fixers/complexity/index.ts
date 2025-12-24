/**
 * @module commands/fix/fixers/complexity
 * @description High complexity fixer
 *
 * Detects functions with high cyclomatic complexity
 * and suggests extraction of complex logic.
 */

import type { Fixer, QualityIssue, FixOperation } from '../../core/types';
import { createFixerMetadata } from '../../core/registry';

export const metadata = createFixerMetadata('complexity', 'High Complexity', 'complexity', {
  description: 'Refactor high complexity functions',
  difficulty: 'risky',
  cliFlag: '--fix-complexity',
  tags: ['risky', 'refactoring', 'complexity'],
});

const MAX_COMPLEXITY = 10;

// Patterns that increase complexity
const COMPLEXITY_PATTERNS = [
  /\bif\s*\(/g,
  /\belse\s+if\s*\(/g,
  /\bwhile\s*\(/g,
  /\bfor\s*\(/g,
  /\bswitch\s*\(/g,
  /\bcase\s+/g,
  /\bcatch\s*\(/g,
  /\?\s*[^:]+:/g,  // ternary
  /&&/g,
  /\|\|/g,
];

interface FunctionBlock {
  name: string;
  startLine: number;
  endLine: number;
  complexity: number;
}

function calculateComplexity(lines: string[]): number {
  let complexity = 1; // Base complexity

  for (const line of lines) {
    for (const pattern of COMPLEXITY_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = line.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
  }

  return complexity;
}

function findFunctions(content: string): FunctionBlock[] {
  const functions: FunctionBlock[] = [];
  const lines = content.split('\n');

  let currentFunction: FunctionBlock | null = null;
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
        complexity: 1,
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
      const funcLines = lines.slice(currentFunction.startLine - 1, currentFunction.endLine);
      currentFunction.complexity = calculateComplexity(funcLines);
      functions.push(currentFunction);
      currentFunction = null;
    }
  }

  return functions;
}

function analyzeComplexity(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];

  // Skip test files
  if (file.includes('.test.') || file.includes('.spec.')) {
    return issues;
  }

  const functions = findFunctions(content);

  for (const func of functions) {
    if (func.complexity > MAX_COMPLEXITY) {
      issues.push({
        file,
        line: func.startLine,
        severity: func.complexity > MAX_COMPLEXITY * 2 ? 'error' : 'warning',
        category: 'complexity',
        message: `Function '${func.name}' has high complexity: ${func.complexity} (max: ${MAX_COMPLEXITY})`,
        suggestion: 'Extract complex logic into smaller helper functions',
        snippet: `${func.name}(): complexity ${func.complexity}`,
        fixerId: 'complexity',
      });
    }
  }

  return issues;
}

function fixComplexityIssue(_issue: QualityIssue, _content: string): FixOperation | null {
  // Complexity fixes require AST analysis and are risky
  // Return null for now - this would need AI assistance or manual review
  return null;
}

export const complexityFixer: Fixer = {
  metadata,
  analyze: analyzeComplexity,
  fix: fixComplexityIssue,
};
