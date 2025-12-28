/**
 * @module lib/@tokens
 * @description Token counting and budget fitting utilities for LLM context management
 *
 * This module provides utilities for:
 * - Accurate token counting using GPT tokenizer (OpenAI/Claude compatible)
 * - Fast token estimation when exact counts aren't needed
 * - Binary search optimization for fitting content to token budgets
 * - Human-readable token count formatting
 *
 * @example
 * ```typescript
 * import {
 *   countTokens,
 *   estimateTokens,
 *   fitToBudget,
 *   formatTokenCount,
 * } from '@/lib/@tokens';
 *
 * // Count tokens in text
 * const tokens = countTokens('Hello, world!');
 *
 * // Fit files to context window
 * const result = fitToBudget(
 *   files,
 *   (subset) => subset.join('\n'),
 *   4000
 * );
 *
 * console.log(`Using ${formatTokenCount(result.tokensUsed)} tokens`);
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export type {
  FitToBudgetResult,
  FormatTokenCountOptions,
  TokenBudgetOptions,
  TokenEncoder,
} from './types';

// ============================================================================
// Counting Exports
// ============================================================================

export {
  CHARS_PER_TOKEN,
  countTokens,
  countTokensAsync,
  estimateTokens,
  formatTokenCount,
} from './counting';

// ============================================================================
// Budget Exports
// ============================================================================

export {
  calculateBudgetUsage,
  fitsWithinBudget,
  fitToBudget,
  fitToBudgetWithOptions,
  getRemainingBudget,
} from './budget';
