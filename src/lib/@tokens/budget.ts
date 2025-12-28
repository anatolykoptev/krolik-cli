/**
 * @module lib/@tokens/budget
 * @description Token budget fitting utilities using binary search optimization
 *
 * Provides efficient algorithms to fit content within LLM context limits.
 * Uses binary search to find optimal item count in O(log n) format function calls.
 */

import { countTokens } from './counting';
import type { FitToBudgetResult, TokenBudgetOptions } from './types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Empty result returned for edge cases (empty items, zero budget, etc.)
 */
const EMPTY_RESULT = <T>(): FitToBudgetResult<T> => ({
  items: [],
  output: '',
  tokensUsed: 0,
  itemsIncluded: 0,
});

// ============================================================================
// Public API
// ============================================================================

/**
 * Fits items to a token budget using binary search optimization.
 *
 * Given an array of items ordered by priority (most important first),
 * finds the maximum number of items that can be included while staying
 * within the token budget. Uses binary search for O(log n) efficiency.
 *
 * @typeParam T - The type of items being fitted
 * @param items - Array of items ordered by priority (most important first)
 * @param formatFn - Function to format items into a string for token counting
 * @param maxTokens - Maximum allowed tokens in the output
 * @returns Object containing fitted items, output, and token usage metadata
 *
 * @example
 * ```typescript
 * // Fit files to a context window
 * const files = ['src/main.ts', 'src/utils.ts', 'src/config.ts'];
 * const result = fitToBudget(
 *   files,
 *   (subset) => subset.map(f => `File: ${f}\nContent: ...`).join('\n\n'),
 *   4000
 * );
 *
 * console.log(`Included ${result.itemsIncluded} of ${files.length} files`);
 * console.log(`Used ${result.tokensUsed} of 4000 tokens`);
 * ```
 *
 * @example
 * ```typescript
 * // Fit code snippets with metadata
 * interface CodeSnippet {
 *   path: string;
 *   content: string;
 *   relevance: number;
 * }
 *
 * const snippets: CodeSnippet[] = [
 *   { path: 'core.ts', content: '...', relevance: 1.0 },
 *   { path: 'utils.ts', content: '...', relevance: 0.8 },
 * ];
 *
 * const result = fitToBudget<CodeSnippet>(
 *   snippets.sort((a, b) => b.relevance - a.relevance),
 *   (items) => items.map(s => `// ${s.path}\n${s.content}`).join('\n'),
 *   2000
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Using with options object
 * const result = fitToBudgetWithOptions({
 *   items: ['item1', 'item2', 'item3'],
 *   formatFn: (items) => items.join(', '),
 *   maxTokens: 100,
 * });
 * ```
 */
export function fitToBudget<T>(
  items: T[],
  formatFn: (items: T[]) => string,
  maxTokens: number,
): FitToBudgetResult<T> {
  // Handle edge cases
  if (items.length === 0 || maxTokens <= 0) {
    return EMPTY_RESULT<T>();
  }

  // Binary search for optimal item count
  let lower = 0;
  let upper = items.length;
  let best: FitToBudgetResult<T> = EMPTY_RESULT<T>();

  while (lower <= upper) {
    const mid = Math.floor((lower + upper) / 2);

    // Skip 0 items case (handled by initial empty result)
    if (mid === 0) {
      lower = mid + 1;
      continue;
    }

    const subset = items.slice(0, mid);
    const output = formatFn(subset);
    const tokens = countTokens(output);

    if (tokens <= maxTokens) {
      // This fits - record if better and try more items
      if (tokens > best.tokensUsed || mid > best.itemsIncluded) {
        best = {
          items: subset,
          output,
          tokensUsed: tokens,
          itemsIncluded: mid,
        };
      }
      lower = mid + 1;
    } else {
      // Too many tokens - try fewer items
      upper = mid - 1;
    }
  }

  return best;
}

/**
 * Fits items to a token budget using an options object.
 *
 * Alternative API for fitToBudget that accepts a single options object.
 * Useful when parameters are constructed dynamically or passed through.
 *
 * @typeParam T - The type of items being fitted
 * @param options - Configuration object with items, formatFn, and maxTokens
 * @returns Object containing fitted items, output, and token usage metadata
 *
 * @example
 * ```typescript
 * const options = {
 *   items: documents,
 *   formatFn: formatDocs,
 *   maxTokens: config.contextLimit,
 * };
 *
 * const result = fitToBudgetWithOptions(options);
 * ```
 */
export function fitToBudgetWithOptions<T>(options: TokenBudgetOptions<T>): FitToBudgetResult<T> {
  return fitToBudget(options.items, options.formatFn, options.maxTokens);
}

/**
 * Calculates the percentage of budget used.
 *
 * Utility function for displaying budget utilization.
 *
 * @param tokensUsed - Number of tokens actually used
 * @param maxTokens - Maximum token budget
 * @returns Percentage of budget used (0-100), capped at 100
 *
 * @example
 * ```typescript
 * const result = fitToBudget(items, formatFn, 4000);
 * const usage = calculateBudgetUsage(result.tokensUsed, 4000);
 * console.log(`Budget usage: ${usage.toFixed(1)}%`); // "Budget usage: 87.5%"
 * ```
 */
export function calculateBudgetUsage(tokensUsed: number, maxTokens: number): number {
  if (maxTokens <= 0) {
    return 0;
  }

  const percentage = (tokensUsed / maxTokens) * 100;
  return Math.min(percentage, 100);
}

/**
 * Checks if content fits within a token budget.
 *
 * Simple utility for budget validation without full fitting.
 *
 * @param content - The content to check
 * @param maxTokens - Maximum allowed tokens
 * @returns True if content fits within budget, false otherwise
 *
 * @example
 * ```typescript
 * const prompt = buildPrompt(data);
 *
 * if (fitsWithinBudget(prompt, 4000)) {
 *   await sendToLLM(prompt);
 * } else {
 *   console.log('Prompt exceeds context limit');
 * }
 * ```
 */
export function fitsWithinBudget(content: string, maxTokens: number): boolean {
  return countTokens(content) <= maxTokens;
}

/**
 * Calculates remaining token budget after content.
 *
 * @param content - Content already using tokens
 * @param maxTokens - Total token budget
 * @returns Remaining tokens (may be negative if over budget)
 *
 * @example
 * ```typescript
 * const systemPrompt = 'You are a helpful assistant...';
 * const remaining = getRemainingBudget(systemPrompt, 4000);
 * console.log(`${remaining} tokens available for user content`);
 * ```
 */
export function getRemainingBudget(content: string, maxTokens: number): number {
  return maxTokens - countTokens(content);
}
