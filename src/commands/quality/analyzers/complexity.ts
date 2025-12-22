/**
 * @module commands/quality/analyzers/complexity
 * @description Cyclomatic complexity calculation and function extraction
 */

import type { FunctionInfo } from '../types';

// ============================================================================
// CYCLOMATIC COMPLEXITY
// ============================================================================

/**
 * Patterns that increase cyclomatic complexity
 * Each match adds 1 to the complexity score
 */
const COMPLEXITY_PATTERNS = [
  /\bif\s*\(/g, // if statements
  /\belse\s+if\s*\(/g, // else if (counted separately)
  /\bfor\s*\(/g, // for loops
  /\bwhile\s*\(/g, // while loops
  /\bdo\s*\{/g, // do-while loops
  /\bcase\s+[^:]+:/g, // switch cases
  /\bcatch\s*\(/g, // catch blocks
  /\?\s*[^:]+:/g, // ternary operators
  /&&/g, // logical AND
  /\|\|/g, // logical OR
  /\?\?/g, // nullish coalescing
];

/**
 * Calculate cyclomatic complexity for a code block
 * Base complexity is 1, each decision point adds 1
 */
export function calculateComplexity(code: string): number {
  let complexity = 1; // Base complexity

  for (const pattern of COMPLEXITY_PATTERNS) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

// ============================================================================
// FUNCTION EXTRACTION
// ============================================================================

/**
 * Reserved keywords that should not be matched as function names
 */
const RESERVED_KEYWORDS = new Set([
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'try',
  'catch',
  'finally',
  'throw',
  'return',
  'break',
  'continue',
  'new',
  'delete',
  'typeof',
  'instanceof',
  'void',
  'this',
  'super',
  'class',
  'extends',
  'import',
  'export',
  'default',
  'yield',
  'await',
  'with',
  'debugger',
]);

/**
 * Patterns for function definitions
 */
const FUNCTION_PATTERNS = [
  // export function name() / export async function name()
  /^(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)/,
  // export const name = () => / export const name = async () =>
  /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/,
  // export const name = function() / export const name = async function()
  /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?function\s*\([^)]*\)/,
  // Method in object: name() { / async name() {
  /^\s+(async\s+)?(\w+)\s*\([^)]*\)\s*\{/,
];

/**
 * Extract function information from file content
 */
export function extractFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split('\n');

  let braceDepth = 0;
  let currentFunction: Partial<FunctionInfo> | null = null;
  let hasJSDoc = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Track JSDoc
    if (trimmed.startsWith('/**')) {
      hasJSDoc = true;
    }

    // Check for function start
    if (!currentFunction) {
      for (const pattern of FUNCTION_PATTERNS) {
        const match = line.match(pattern);
        if (match) {
          const isExported = line.includes('export');
          const isAsync = line.includes('async');
          // Extract function name from match groups
          const name = match[3] || match[2] || 'anonymous';

          // Skip reserved keywords (if, for, while, etc.)
          if (RESERVED_KEYWORDS.has(name)) {
            continue;
          }

          const params = (match[4] || '').split(',').filter(Boolean).length;

          currentFunction = {
            name,
            startLine: i + 1,
            isExported,
            isAsync,
            hasJSDoc,
            params,
          };

          // Reset JSDoc tracker
          hasJSDoc = false;
          break;
        }
      }
    }

    // Track braces for function end
    for (const char of line) {
      if (char === '{') braceDepth++;
      if (char === '}') braceDepth--;
    }

    // Function ends when braces balance
    if (currentFunction && braceDepth === 0 && line.includes('}')) {
      const startLine = currentFunction.startLine!;
      const endLine = i + 1;
      // Extract function body for complexity calculation
      const functionBody = lines.slice(startLine - 1, endLine).join('\n');
      const complexity = calculateComplexity(functionBody);

      functions.push({
        name: currentFunction.name!,
        startLine,
        endLine,
        lines: endLine - startLine,
        params: currentFunction.params || 0,
        isExported: currentFunction.isExported || false,
        isAsync: currentFunction.isAsync || false,
        hasJSDoc: currentFunction.hasJSDoc || false,
        complexity,
      });
      currentFunction = null;
    }
  }

  return functions;
}
