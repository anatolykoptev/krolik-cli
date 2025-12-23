/**
 * @module commands/fix/strategies/complexity/helpers
 * @description Helper functions for complexity analysis
 */

import { lineStartsWith } from '../shared';
import {
  FUNCTION_NAME_MAP,
  DEFAULT_FUNCTION_NAME,
  MIN_BLOCK_SIZE,
  MIN_IF_CHAIN_LENGTH,
} from './patterns';

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionRange {
  start: number;
  end: number;
}

// ============================================================================
// FUNCTION BOUNDARY DETECTION
// ============================================================================

/**
 * Find the end of a function starting at a line
 * Uses brace counting (simple but effective for most cases)
 *
 * @param lines - Array of lines
 * @param startLine - 1-based line number where function starts
 * @returns 1-based line number where function ends, or null
 */
export function findFunctionEnd(
  lines: string[],
  startLine: number,
): number | null {
  let braceCount = 0;
  let started = false;

  for (let i = startLine - 1; i < lines.length; i++) {
    const line = lines[i] ?? '';

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

// ============================================================================
// EXTRACTION RANGE DETECTION
// ============================================================================

/** Block start patterns (statements that create a new scope) */
const BLOCK_START_PATTERNS = ['if (', 'for (', 'while (', 'try {'];

/** Comment separator pattern */
const COMMENT_SEPARATOR = '// ===';

/**
 * Find a good range to extract from a long function
 * Looks for logical blocks (if, for, while, try) that are self-contained
 *
 * @param lines - Array of lines
 * @param funcStart - 1-based line number where function starts
 * @param funcEnd - 1-based line number where function ends
 */
export function findExtractionRange(
  lines: string[],
  funcStart: number,
  funcEnd: number,
): ExtractionRange | null {
  let blockStart: number | null = null;
  let braceCount = 0;
  let inFunction = false;

  for (let i = funcStart; i < funcEnd - 1; i++) {
    const line = lines[i] ?? '';
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

    // Look for significant block starts (one level inside the function)
    const isBlockStart =
      lineStartsWith(trimmed, BLOCK_START_PATTERNS) ||
      trimmed.includes(COMMENT_SEPARATOR);

    if (inFunction && braceCount === 2 && blockStart === null && isBlockStart) {
      blockStart = i + 1;
    }

    // Block ends when we return to function-level depth
    if (blockStart !== null && braceCount === 1 && trimmed.includes('}')) {
      const blockSize = i + 1 - blockStart;

      // Only extract if the block is significant
      if (blockSize >= MIN_BLOCK_SIZE) {
        return { start: blockStart, end: i + 1 };
      }

      blockStart = null;
    }
  }

  // Fallback: extract middle portion of the function
  return extractMiddleThird(funcStart, funcEnd);
}

/**
 * Extract the middle third of a function as fallback
 */
function extractMiddleThird(
  funcStart: number,
  funcEnd: number,
): ExtractionRange | null {
  const funcLength = funcEnd - funcStart;

  if (funcLength <= MIN_IF_CHAIN_LENGTH) {
    return null;
  }

  const thirdLength = Math.floor(funcLength / MIN_IF_CHAIN_LENGTH);

  return {
    start: funcStart + thirdLength,
    end: funcStart + thirdLength * 2,
  };
}

// ============================================================================
// FUNCTION NAME GENERATION
// ============================================================================

/**
 * Generate a meaningful function name from block content
 * Uses keyword matching to suggest appropriate names
 */
export function generateFunctionName(content: string): string {
  const lower = content.toLowerCase();

  for (const [keyword, funcName] of Object.entries(FUNCTION_NAME_MAP)) {
    if (lower.includes(keyword)) {
      return funcName;
    }
  }

  return DEFAULT_FUNCTION_NAME;
}
