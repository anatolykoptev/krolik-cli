/**
 * @module lib/@tokens/counting
 * @description Token counting utilities for LLM context management
 *
 * Provides accurate token counting using GPT tokenizer (compatible with OpenAI/Claude)
 * with automatic fallback to character-based estimation when the tokenizer is unavailable.
 */

import type { TokenEncoder } from './types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Average number of characters per token for English text and code.
 * Based on empirical analysis of GPT tokenization patterns.
 *
 * @remarks
 * - English prose: ~4.0 chars/token
 * - Source code: ~3.5-4.5 chars/token
 * - Mixed content: ~4.0 chars/token (good middle ground)
 */
export const CHARS_PER_TOKEN = 4;

/**
 * Minimum text length to avoid division edge cases.
 */
const MIN_TEXT_LENGTH = 0;

// ============================================================================
// Tokenizer State
// ============================================================================

/**
 * Cached tokenizer encode function.
 * Lazily initialized on first use.
 */
let cachedEncoder: TokenEncoder | null = null;

/**
 * Whether initialization has been attempted.
 */
let initializationAttempted = false;

/**
 * Creates a fallback encoder based on character estimation.
 * Used when gpt-tokenizer is not available.
 *
 * @returns A token encoder function that estimates tokens from character count
 */
function createFallbackEncoder(): TokenEncoder {
  return (text: string): number[] => {
    const estimatedTokens = Math.ceil(text.length / CHARS_PER_TOKEN);
    // Return array of indices to match encode() signature
    return Array.from({ length: estimatedTokens }, (_, i) => i);
  };
}

/**
 * Initializes the tokenizer encoder.
 * Uses dynamic import to avoid bundling gpt-tokenizer when not needed.
 *
 * @returns Promise that resolves to the encoder function
 */
async function initializeEncoder(): Promise<TokenEncoder> {
  if (cachedEncoder !== null) {
    return cachedEncoder;
  }

  if (initializationAttempted) {
    // Already tried and failed, use fallback
    cachedEncoder = createFallbackEncoder();
    return cachedEncoder;
  }

  initializationAttempted = true;

  try {
    const gptTokenizer = await import('gpt-tokenizer');
    cachedEncoder = gptTokenizer.encode;
    return cachedEncoder;
  } catch {
    // gpt-tokenizer not available, use fallback
    cachedEncoder = createFallbackEncoder();
    return cachedEncoder;
  }
}

/**
 * Gets the encoder synchronously.
 * If not yet initialized, returns the fallback encoder and triggers async init.
 *
 * @returns The encoder function (may be fallback if not yet initialized)
 */
function getEncoderSync(): TokenEncoder {
  if (cachedEncoder !== null) {
    return cachedEncoder;
  }

  // Trigger async initialization for future calls
  void initializeEncoder();

  // Return fallback for immediate use
  return createFallbackEncoder();
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Counts the exact number of tokens in a text string.
 *
 * Uses GPT tokenizer for accurate counting compatible with OpenAI and Claude models.
 * Falls back to character-based estimation (~4 chars/token) if tokenizer unavailable.
 *
 * @param text - The text to count tokens for
 * @returns The number of tokens in the text
 *
 * @example
 * ```typescript
 * // Basic usage
 * const tokens = countTokens('Hello, world!');
 * console.log(tokens); // ~4 tokens
 *
 * // Count tokens in code
 * const codeTokens = countTokens('function greet() { return "hi"; }');
 * console.log(codeTokens); // ~12 tokens
 *
 * // Empty string handling
 * const empty = countTokens('');
 * console.log(empty); // 0
 * ```
 */
export function countTokens(text: string): number {
  if (text.length === MIN_TEXT_LENGTH) {
    return 0;
  }

  const encoder = getEncoderSync();
  return encoder(text).length;
}

/**
 * Counts tokens asynchronously, ensuring the accurate tokenizer is loaded.
 *
 * Use this when you need guaranteed accurate counts and can await the result.
 * The first call may be slightly slower due to dynamic import.
 *
 * @param text - The text to count tokens for
 * @returns Promise resolving to the number of tokens
 *
 * @example
 * ```typescript
 * // Ensure accurate tokenizer is used
 * const tokens = await countTokensAsync('Complex code snippet...');
 * console.log(`Accurate count: ${tokens}`);
 * ```
 */
export async function countTokensAsync(text: string): Promise<number> {
  if (text.length === MIN_TEXT_LENGTH) {
    return 0;
  }

  const encoder = await initializeEncoder();
  return encoder(text).length;
}

/**
 * Estimates token count using character-based heuristic.
 *
 * Faster than exact counting but less accurate.
 * Good for rough estimates, progress indicators, or when tokenizer is unavailable.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated number of tokens (ceiling of chars / CHARS_PER_TOKEN)
 *
 * @example
 * ```typescript
 * // Quick estimation for large files
 * const estimate = estimateTokens(largeFileContent);
 * console.log(`~${estimate} tokens (estimated)`);
 *
 * // Compare with exact count
 * const exact = countTokens(text);
 * const estimated = estimateTokens(text);
 * console.log(`Exact: ${exact}, Estimated: ${estimated}`);
 * ```
 */
export function estimateTokens(text: string): number {
  if (text.length === MIN_TEXT_LENGTH) {
    return 0;
  }

  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Formats a token count for human-readable display.
 *
 * Converts large numbers to 'k' notation (e.g., 1500 -> "1.5k").
 * Small numbers are returned as-is.
 *
 * @param tokens - The token count to format
 * @param options - Formatting options
 * @returns Formatted string representation
 *
 * @example
 * ```typescript
 * // Basic formatting
 * formatTokenCount(500);     // "500"
 * formatTokenCount(1500);    // "1.5k"
 * formatTokenCount(12345);   // "12.3k"
 *
 * // Custom threshold
 * formatTokenCount(500, { threshold: 100 }); // "0.5k"
 *
 * // Custom decimals
 * formatTokenCount(1234, { decimals: 2 }); // "1.23k"
 * ```
 */
export function formatTokenCount(
  tokens: number,
  options: { threshold?: number; decimals?: number } = {},
): string {
  const { threshold = 1000, decimals = 1 } = options;

  if (tokens >= threshold) {
    return `${(tokens / 1000).toFixed(decimals)}k`;
  }

  return String(tokens);
}
