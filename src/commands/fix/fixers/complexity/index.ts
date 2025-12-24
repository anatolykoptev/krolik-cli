/**
 * @module commands/fix/fixers/complexity
 * @description High complexity fixer using AST
 *
 * Detects functions with high cyclomatic complexity
 * and suggests extraction of complex logic.
 * Uses ts-morph AST for accurate function detection.
 */

import type { Fixer, QualityIssue, FixOperation } from '../../core/types';
import { createFixerMetadata } from '../../core/registry';
import {
  parseCode,
  extractFunctions,
  type FunctionInfo,
} from '../../../../lib/@ast';

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
  isAsync: boolean;
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

/**
 * Find functions using AST with complexity calculation
 */
function findFunctionsWithComplexity(content: string, filePath: string): FunctionBlock[] {
  const lines = content.split('\n');

  try {
    const sourceFile = parseCode(content, filePath);
    const astFunctions = extractFunctions(sourceFile);

    return astFunctions.map((f: FunctionInfo) => {
      const funcLines = lines.slice(f.startLine - 1, f.endLine);
      return {
        name: f.name,
        startLine: f.startLine,
        endLine: f.endLine,
        complexity: calculateComplexity(funcLines),
        isAsync: f.isAsync,
      };
    });
  } catch {
    // Fallback to regex-based detection
    return findFunctionsRegex(content);
  }
}

/**
 * Fallback regex-based function detection with complexity
 */
function findFunctionsRegex(content: string): FunctionBlock[] {
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
        isAsync: line.includes('async'),
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

  const functions = findFunctionsWithComplexity(content, file);

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

/**
 * Analyze switch statements for potential object mapping refactor
 */
function findSwitchBlocks(lines: string[], startLine: number, endLine: number): { line: number; cases: number }[] {
  const switches: { line: number; cases: number }[] = [];
  let inSwitch = false;
  let switchLine = 0;
  let caseCount = 0;
  let braceDepth = 0;

  for (let i = startLine - 1; i < endLine; i++) {
    const line = lines[i] ?? '';

    if (/\bswitch\s*\(/.test(line)) {
      inSwitch = true;
      switchLine = i + 1;
      caseCount = 0;
      braceDepth = 0;
    }

    if (inSwitch) {
      for (const char of line) {
        if (char === '{') braceDepth++;
        if (char === '}') braceDepth--;
      }

      if (/\bcase\s+/.test(line)) caseCount++;

      if (braceDepth === 0 && line.includes('}')) {
        if (caseCount >= 3) {
          switches.push({ line: switchLine, cases: caseCount });
        }
        inSwitch = false;
      }
    }
  }

  return switches;
}

/**
 * Find deeply nested if-else chains
 */
function findNestedIfElse(lines: string[], startLine: number, endLine: number): { line: number; depth: number }[] {
  const chains: { line: number; depth: number }[] = [];
  let maxDepth = 0;
  let chainStartLine = 0;
  let currentDepth = 0;

  for (let i = startLine - 1; i < endLine; i++) {
    const line = lines[i] ?? '';

    if (/\bif\s*\(/.test(line)) {
      if (currentDepth === 0) chainStartLine = i + 1;
      currentDepth++;
      maxDepth = Math.max(maxDepth, currentDepth);
    }

    // Count braces to track nesting
    for (const char of line) {
      if (char === '}') {
        currentDepth = Math.max(0, currentDepth - 1);
      }
    }

    // Chain ended
    if (currentDepth === 0 && maxDepth >= 3) {
      chains.push({ line: chainStartLine, depth: maxDepth });
      maxDepth = 0;
    }
  }

  return chains;
}

/**
 * Generate specific refactoring suggestions based on complexity sources
 */
function analyzeComplexitySources(lines: string[], startLine: number, endLine: number): string[] {
  const suggestions: string[] = [];

  const switches = findSwitchBlocks(lines, startLine, endLine);
  const nestedIfs = findNestedIfElse(lines, startLine, endLine);

  // Count specific patterns
  let ternaryCount = 0;
  let logicalOpCount = 0;

  for (let i = startLine - 1; i < endLine; i++) {
    const line = lines[i] ?? '';
    ternaryCount += (line.match(/\?\s*[^:]+:/g) || []).length;
    logicalOpCount += (line.match(/&&|\|\|/g) || []).length;
  }

  // Generate specific suggestions
  if (switches.length > 0) {
    const totalCases = switches.reduce((sum, s) => sum + s.cases, 0);
    suggestions.push(`• Replace switch (${totalCases} cases) with object lookup/mapping`);
  }

  if (nestedIfs.length > 0) {
    const maxDepth = Math.max(...nestedIfs.map(n => n.depth));
    suggestions.push(`• Reduce nesting (depth ${maxDepth}) using early returns/guard clauses`);
  }

  if (ternaryCount > 2) {
    suggestions.push(`• Simplify ${ternaryCount} ternary operators - extract to named variables`);
  }

  if (logicalOpCount > 5) {
    suggestions.push(`• Extract complex conditions (${logicalOpCount} logical ops) to named functions`);
  }

  return suggestions;
}

function fixComplexityIssue(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');

  // Find the function at this line using AST
  const functions = findFunctionsWithComplexity(content, issue.file);
  const targetFunc = functions.find(f => f.startLine === issue.line);

  if (!targetFunc) return null;

  // Analyze what's causing the complexity
  const suggestions = analyzeComplexitySources(lines, targetFunc.startLine, targetFunc.endLine);

  if (suggestions.length === 0) {
    suggestions.push('• Extract validation logic into guard clauses');
    suggestions.push('• Split into smaller single-purpose functions');
    suggestions.push('• Consider strategy pattern for branching logic');
  }

  // Generate actionable TODO
  const todoComment = `// TODO: Reduce complexity of ${targetFunc.name} (current: ${targetFunc.complexity}, max: ${MAX_COMPLEXITY})
// Refactoring suggestions:
${suggestions.join('\n')}
//
// Example: Replace switch with object mapping:
//   const handlers = { case1: () => {...}, case2: () => {...} };
//   return handlers[key]?.() ?? defaultHandler();
`;

  return {
    action: 'insert-before',
    file: issue.file,
    line: targetFunc.startLine,
    newCode: todoComment,
  };
}

export const complexityFixer: Fixer = {
  metadata,
  analyze: analyzeComplexity,
  fix: fixComplexityIssue,
};
