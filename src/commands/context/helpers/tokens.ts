/**
 * @module commands/context/helpers/tokens
 * @description Token counting and budget fitting for Smart Context
 */

// Check if gpt-tokenizer is available, fallback to character estimation if not
let encode: (text: string) => number[];

try {
  const gptTokenizer = await import('gpt-tokenizer');
  encode = gptTokenizer.encode;
} catch {
  // Fallback: ~4 chars per token for English code
  encode = (text: string) => {
    const tokens: number[] = [];
    for (let i = 0; i < Math.ceil(text.length / 4); i++) {
      tokens.push(i);
    }
    return tokens;
  };
}

/**
 * Count tokens in text
 */
export function countTokens(text: string): number {
  return encode(text).length;
}

/**
 * Fit content to token budget using binary search
 */
export function fitToBudget<T>(
  items: T[],
  formatFn: (items: T[]) => string,
  maxTokens: number,
): {
  items: T[];
  output: string;
  tokensUsed: number;
  itemsIncluded: number;
} {
  if (items.length === 0) {
    return { items: [], output: '', tokensUsed: 0, itemsIncluded: 0 };
  }

  // Binary search for optimal item count
  let lower = 0;
  let upper = items.length;
  let best = { items: [] as T[], output: '', tokensUsed: 0, itemsIncluded: 0 };

  while (lower <= upper) {
    const mid = Math.floor((lower + upper) / 2);
    const subset = items.slice(0, mid);
    const output = formatFn(subset);
    const tokens = countTokens(output);

    if (tokens <= maxTokens) {
      if (tokens > best.tokensUsed) {
        best = { items: subset, output, tokensUsed: tokens, itemsIncluded: mid };
      }
      lower = mid + 1;
    } else {
      upper = mid - 1;
    }
  }

  return best;
}

/**
 * Estimate tokens without exact count (faster)
 */
export function estimateTokens(text: string): number {
  // ~4 chars per token for code
  return Math.ceil(text.length / 4);
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return String(tokens);
}
