/**
 * @module commands/audit/suggestions/complexity-suggestions
 * @description Complexity issue suggestion generators
 *
 * Generates refactoring hints for high-complexity code.
 */

import type { Suggestion, SuggestionContext } from './types';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate suggestion for complexity issues
 *
 * Provides hints for refactoring rather than direct fixes.
 * Complexity issues typically require manual intervention.
 */
export function generateComplexitySuggestion(context: SuggestionContext): Suggestion | null {
  const { issue, lineContent } = context;

  // Extract complexity value if available
  const complexityMatch = issue.message.match(/complexity[:\s]+(\d+)/i);
  const complexity = complexityMatch?.[1] ? Number.parseInt(complexityMatch[1], 10) : 0;

  if (complexity === 0) {
    return null;
  }

  const before = lineContent.trim();

  // Provide refactoring hint based on complexity level
  let reasoning: string;
  let after: string;

  if (complexity > 20) {
    reasoning = `High complexity (${complexity}). Consider extracting to multiple smaller functions.`;
    after = `// TODO: Refactor - extract helper functions to reduce complexity from ${complexity}`;
  } else if (complexity > 10) {
    reasoning = `Moderate complexity (${complexity}). Consider extracting conditional blocks.`;
    after = `// TODO: Consider extracting complex logic to helper function`;
  } else {
    reasoning = `Slightly elevated complexity (${complexity}). Consider simplifying conditionals.`;
    after = `// NOTE: Could be simplified`;
  }

  return {
    before,
    after: `${after}\n${before}`,
    reasoning,
    confidence: 50, // Hints are lower confidence than direct fixes
  };
}
