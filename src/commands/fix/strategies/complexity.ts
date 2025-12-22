/**
 * @module commands/fix/strategies/complexity
 * @description AST-based fix strategies for complexity issues
 *
 * Uses ts-morph for safe code transformations:
 * - Function extraction for high complexity
 * - Early returns for deep nesting
 * - Block extraction for long functions
 */

import type { QualityIssue } from '../../quality/types';
import type { FixOperation, FixStrategy } from '../types';
import { reduceNesting, extractFunction } from '../ast-utils';
import { findRefactorings, detectIfChain, generateLookupMap } from '../refactorings';

// ============================================================================
// COMPLEXITY PATTERNS
// ============================================================================

/**
 * Patterns we can fix with AST transformations
 */
const FIXABLE_PATTERNS = {
  NESTING: /nesting depth/i,
  // Match: "has complexity 25 (max: 10)"
  COMPLEXITY: /has\s+complexity\s+(\d+)/i,
  // Match: "has 50 lines (max: 30)" or "function ... 50 lines"
  LONG_FUNCTION: /(\d+)\s*lines/i,
};

/**
 * Complexity fix strategy using AST transformations
 */
export const complexityStrategy: FixStrategy = {
  categories: ['complexity'],

  canFix(issue: QualityIssue, _content: string): boolean {
    const { message } = issue;

    // We can fix nesting issues with early returns
    if (FIXABLE_PATTERNS.NESTING.test(message)) {
      return true;
    }

    // We can attempt to fix complexity with smart refactorings
    if (FIXABLE_PATTERNS.COMPLEXITY.test(message)) {
      const match = message.match(/has\s+complexity\s+(\d+)/i);
      const complexity = match ? parseInt(match[1] || '0', 10) : 0;
      // Now we can handle higher complexity with if-chain→map and other refactorings
      return complexity >= 10 && complexity <= 120;
    }

    // Long functions can be partially fixed with extraction
    if (FIXABLE_PATTERNS.LONG_FUNCTION.test(message)) {
      const match = message.match(/(\d+)\s*lines/i);
      const lines = match ? parseInt(match[1] || '0', 10) : 0;
      // Only try to fix moderately long functions
      return lines >= 50 && lines <= 200;
    }

    return false;
  },

  generateFix(issue: QualityIssue, content: string): FixOperation | null {
    const { message, line, file } = issue;

    // Nesting depth issues -> apply early returns
    if (FIXABLE_PATTERNS.NESTING.test(message)) {
      return generateNestingFix(content, file, line);
    }

    // Complexity issues -> try early returns first
    if (FIXABLE_PATTERNS.COMPLEXITY.test(message)) {
      return generateComplexityFix(content, file, line);
    }

    // Long function -> suggest extraction points
    if (FIXABLE_PATTERNS.LONG_FUNCTION.test(message)) {
      return generateLongFunctionFix(content, file, line);
    }

    return null;
  },
};

// ============================================================================
// FIX GENERATORS
// ============================================================================

/**
 * Fix deep nesting with early returns
 */
function generateNestingFix(
  content: string,
  file: string,
  targetLine?: number,
): FixOperation | null {
  const result = reduceNesting(content, file, targetLine);

  if (!result.success || !result.newContent) {
    return null;
  }

  return {
    action: 'replace-range',
    file,
    line: 1,
    endLine: content.split('\n').length,
    oldCode: content,
    newCode: result.newContent,
  };
}

/**
 * Fix high complexity - try multiple strategies
 */
function generateComplexityFix(
  content: string,
  file: string,
  targetLine?: number,
): FixOperation | null {
  const lines = content.split('\n');

  // 1. Try if-chain to map conversion (very effective for complexity)
  if (targetLine) {
    const chain = detectIfChain(content, targetLine);
    if (chain && chain.conditions.length >= 4) {
      const originalCode = lines.slice(chain.startLine - 1, chain.endLine).join('\n');
      const newCode = generateLookupMap(chain);

      return {
        action: 'replace-range',
        file,
        line: chain.startLine,
        endLine: chain.endLine,
        oldCode: originalCode,
        newCode,  // Just the replacement map code
      };
    }
  }

  // 2. Try reducing nesting with early returns
  const nestingResult = reduceNesting(content, file, targetLine);
  if (nestingResult.success && nestingResult.newContent) {
    return {
      action: 'replace-range',
      file,
      line: 1,
      endLine: lines.length,
      oldCode: content,
      newCode: nestingResult.newContent,
    };
  }

  // 3. Try finding any applicable refactorings
  if (targetLine) {
    const funcEnd = findFunctionEnd(lines, targetLine);
    if (funcEnd) {
      const refactorings = findRefactorings(content, targetLine, funcEnd);
      if (refactorings.length > 0) {
        // Apply the first refactoring
        const ref = refactorings[0]!;

        return {
          action: 'replace-range',
          file,
          line: ref.startLine,
          endLine: ref.endLine,
          oldCode: ref.originalCode,
          newCode: ref.newCode,  // Just the replacement, not full file
        };
      }
    }
  }

  return null;
}

/**
 * Fix long functions by extracting logical blocks
 */
function generateLongFunctionFix(
  content: string,
  file: string,
  startLine?: number,
): FixOperation | null {
  if (!startLine) return null;

  const lines = content.split('\n');

  // Find function boundaries
  const functionEnd = findFunctionEnd(lines, startLine);
  if (!functionEnd) return null;

  // Find a good extraction point (first significant block)
  const extractionRange = findExtractionRange(lines, startLine, functionEnd);
  if (!extractionRange) return null;

  // Determine if async
  const funcLine = lines[startLine - 1] || '';
  const isAsync = funcLine.includes('async');

  // Generate a meaningful name based on content
  const blockContent = lines.slice(extractionRange.start - 1, extractionRange.end).join('\n');
  const functionName = generateFunctionName(blockContent);

  const result = extractFunction(content, file, {
    startLine: extractionRange.start,
    endLine: extractionRange.end,
    functionName,
    isAsync,
  });

  if (!result.success || !result.newContent) {
    return null;
  }

  return {
    action: 'replace-range',
    file,
    line: 1,
    endLine: lines.length,
    oldCode: content,
    newCode: result.newContent,
    functionName,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Find the end of a function starting at a line
 */
function findFunctionEnd(lines: string[], startLine: number): number | null {
  let braceCount = 0;
  let started = false;

  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i] || '';

    for (const char of line) {
      if (char === '{') {
        braceCount++;
        started = true;
      }
      if (char === '}') {
        braceCount--;
      }
    }

    if (started && braceCount === 0) {
      return i + 1;
    }
  }

  return null;
}

/**
 * Find a good range to extract from a long function
 */
function findExtractionRange(
  lines: string[],
  funcStart: number,
  funcEnd: number,
): { start: number; end: number } | null {
  // Look for logical blocks (if statements, loops) that are self-contained
  let blockStart: number | null = null;
  let braceCount = 0;
  let inFunction = false;

  for (let i = funcStart; i < funcEnd - 1; i++) {
    const line = lines[i] || '';
    const trimmed = line.trim();

    // Skip the function declaration line
    if (i === funcStart - 1) continue;

    // Track braces
    for (const char of line) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
    }

    // Skip if we're inside nested structures at start
    if (!inFunction && braceCount === 1) {
      inFunction = true;
    }

    // Look for significant block starts
    if (
      inFunction &&
      braceCount === 2 && // One level inside the function
      blockStart === null &&
      (trimmed.startsWith('if (') ||
        trimmed.startsWith('for (') ||
        trimmed.startsWith('while (') ||
        trimmed.startsWith('try {') ||
        trimmed.includes('// ===')) // Comment separator
    ) {
      blockStart = i + 1;
    }

    // Block ends when we return to function-level depth
    if (blockStart !== null && braceCount === 1 && trimmed.includes('}')) {
      const blockSize = i + 1 - blockStart;
      // Only extract if the block is significant (5+ lines)
      if (blockSize >= 5) {
        return { start: blockStart, end: i + 1 };
      }
      blockStart = null;
    }
  }

  // Fallback: extract middle third of the function
  const funcLength = funcEnd - funcStart;
  if (funcLength > 30) {
    const thirdLength = Math.floor(funcLength / 3);
    return {
      start: funcStart + thirdLength,
      end: funcStart + thirdLength * 2,
    };
  }

  return null;
}

/**
 * Keyword to function name mapping
 * Used to generate meaningful names from code content
 */
const FUNCTION_NAME_MAP: Record<string, string> = {
  valid: 'validateInput',
  error: 'handleError',
  catch: 'handleError',
  fetch: 'fetchData',
  request: 'fetchData',
  transform: 'transformData',
  map: 'transformData',
  filter: 'filterItems',
  sort: 'sortItems',
  render: 'renderContent',
  component: 'renderContent',
  init: 'initialize',
  setup: 'initialize',
  clean: 'cleanup',
  dispose: 'cleanup',
  config: 'processConfig',
  option: 'processConfig',
  format: 'formatOutput',
  parse: 'parseInput',
  check: 'checkCondition',
  update: 'updateState',
  create: 'createItem',
  delete: 'removeItem',
  remove: 'removeItem',
};

/**
 * Generate a meaningful function name from block content
 */
function generateFunctionName(content: string): string {
  const trimmed = content.toLowerCase();

  // Use lookup map instead of if-chain
  for (const [keyword, funcName] of Object.entries(FUNCTION_NAME_MAP)) {
    if (trimmed.includes(keyword)) {
      return funcName;
    }
  }

  return 'processBlock';
}
