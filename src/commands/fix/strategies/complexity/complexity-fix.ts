/**
 * @module commands/fix/strategies/complexity/complexity-fix
 * @description Fix generator for high cyclomatic complexity
 */

import { reduceNesting } from '../../ast-utils/index';
import { createFullFileReplace, createReplaceRange, splitLines } from '../../core';
import { detectIfChain, findRefactorings, generateLookupMap } from '../../refactorings';
import type { FixOperation } from '../../types';
import { findFunctionEnd } from './helpers';
import { MIN_IF_CHAIN_LENGTH } from './patterns';

// ============================================================================
// COMPLEXITY FIX
// ============================================================================

/**
 * Fix high complexity using multiple strategies:
 * 1. If-chain to map conversion (most effective)
 * 2. Early returns for nesting reduction
 * 3. Other applicable refactorings
 *
 * @param content - File content
 * @param file - File path
 * @param targetLine - Optional target line number
 */
export function generateComplexityFix(
  content: string,
  file: string,
  targetLine?: number,
): FixOperation | null {
  const lines = splitLines(content);

  // Strategy 1: Try if-chain to map conversion (very effective for complexity)
  const ifChainFix = tryIfChainConversion(content, file, lines, targetLine);
  if (ifChainFix) return ifChainFix;

  // Strategy 2: Try reducing nesting with early returns
  const nestingFix = tryNestingReduction(content, file, lines, targetLine);
  if (nestingFix) return nestingFix;

  // Strategy 3: Try finding any applicable refactorings
  const refactoringFix = tryRefactorings(content, file, lines, targetLine);
  if (refactoringFix) return refactoringFix;

  return null;
}

// ============================================================================
// STRATEGY IMPLEMENTATIONS
// ============================================================================

/**
 * Try converting if-chain to lookup map
 */
function tryIfChainConversion(
  content: string,
  file: string,
  lines: string[],
  targetLine?: number,
): FixOperation | null {
  if (!targetLine) return null;

  const chain = detectIfChain(content, targetLine);

  if (!chain || chain.conditions.length < MIN_IF_CHAIN_LENGTH) {
    return null;
  }

  const originalCode = lines.slice(chain.startLine - 1, chain.endLine).join('\n');

  const newCode = generateLookupMap(chain);

  return createReplaceRange(file, chain.startLine, chain.endLine, originalCode, newCode);
}

/**
 * Try reducing nesting with early returns
 */
function tryNestingReduction(
  content: string,
  file: string,
  _lines: string[],
  targetLine?: number,
): FixOperation | null {
  const result = reduceNesting(content, file, targetLine);

  if (!result.success || !result.newContent) {
    return null;
  }

  return createFullFileReplace(file, content, result.newContent);
}

/**
 * Try applying available refactorings
 */
function tryRefactorings(
  content: string,
  file: string,
  lines: string[],
  targetLine?: number,
): FixOperation | null {
  if (!targetLine) return null;

  const funcEnd = findFunctionEnd(lines, targetLine);

  if (!funcEnd) return null;

  const refactorings = findRefactorings(content, targetLine, funcEnd);

  if (refactorings.length === 0) return null;

  // Apply the first applicable refactoring
  const ref = refactorings[0]!;

  return createReplaceRange(file, ref.startLine, ref.endLine, ref.originalCode, ref.newCode);
}
