/**
 * @module lib/@tokens/types
 * @description Type definitions for token counting and budget fitting utilities
 */

/**
 * Result of fitting items to a token budget.
 *
 * Contains the optimized output that fits within the specified token limit,
 * along with metadata about the fitting process.
 *
 * @typeParam T - The type of items being fitted to the budget
 */
export interface FitToBudgetResult<T> {
  /**
   * The subset of items that fit within the token budget.
   * Items are taken from the beginning of the input array.
   */
  items: T[];

  /**
   * The formatted output string produced by the format function.
   * This string's token count is guaranteed to be <= maxTokens.
   */
  output: string;

  /**
   * Actual number of tokens used in the output.
   * Always <= the maxTokens parameter passed to fitToBudget.
   */
  tokensUsed: number;

  /**
   * Number of items included in the output.
   * Equals items.length for convenience.
   */
  itemsIncluded: number;
}

/**
 * Options for the fitToBudget function.
 *
 * @typeParam T - The type of items being fitted
 */
export interface TokenBudgetOptions<T> {
  /**
   * Array of items to fit within the token budget.
   * Items should be ordered by priority (most important first).
   */
  items: T[];

  /**
   * Function that formats a subset of items into a string.
   * This function will be called multiple times during binary search.
   *
   * @param items - Subset of items to format
   * @returns Formatted string representation
   */
  formatFn: (items: T[]) => string;

  /**
   * Maximum number of tokens allowed in the output.
   * Must be a positive number.
   */
  maxTokens: number;
}

/**
 * Function signature for token counting.
 * Matches the gpt-tokenizer encode function signature.
 */
export type TokenEncoder = (text: string) => number[];

/**
 * Token count format options for human-readable display.
 */
export interface FormatTokenCountOptions {
  /**
   * Threshold above which to use 'k' suffix.
   * @default 1000
   */
  threshold?: number;

  /**
   * Number of decimal places for 'k' format.
   * @default 1
   */
  decimals?: number;
}
