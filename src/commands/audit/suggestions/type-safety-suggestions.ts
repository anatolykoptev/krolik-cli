/**
 * @module commands/audit/suggestions/type-safety-suggestions
 * @description Type safety issue suggestion generators
 *
 * Generates suggestions for any -> unknown conversions with type inference.
 * Includes XML output for AI-friendly context.
 */

import { parseFile } from '../../../lib/@ast/swc';
import {
  buildTypeContext,
  generateTypeContextXml,
  getConfidenceLabel,
  hasAnyType,
  inferTypeFromUsage,
  replaceAnyType,
} from './type-inference';
import type { Suggestion, SuggestionContext, TypeContext } from './types';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Extended suggestion with type context
 */
export interface TypeSafetySuggestion extends Suggestion {
  /** Type context with evidence for XML output */
  typeContext?: TypeContext;
  /** Pre-generated XML representation */
  xml?: string;
}

/**
 * Generate suggestion for type-safety issues (any -> unknown)
 *
 * Attempts to infer the actual type from usage patterns.
 * Falls back to `unknown` which is always safe.
 */
export function generateTypeSafetySuggestion(
  context: SuggestionContext,
): TypeSafetySuggestion | null {
  const { issue, content, filePath, lineContent } = context;

  // Check if this is an `any` type issue
  const isAnyIssue =
    issue.message.toLowerCase().includes('any') ||
    issue.message.toLowerCase().includes('type safety');

  if (!isAnyIssue || !hasAnyType(lineContent)) {
    return null;
  }

  try {
    // Parse the file to analyze usage
    const { ast, lineOffsets, baseOffset } = parseFile(filePath, content);

    // Try to infer type from usage
    const inference = inferTypeFromUsage(ast, lineOffsets, baseOffset, issue.line ?? 1, content);

    // Generate before/after
    const before = lineContent.trim();
    const after = replaceAnyType(lineContent, inference.inferredType).trim();

    // Build reasoning with evidence
    const confidenceLabel = getConfidenceLabel(inference.confidence);
    let reasoning: string;

    if (inference.source === 'fallback') {
      reasoning = 'Safe replacement: unknown requires type guards before use';
    } else {
      reasoning = `Inferred ${inference.inferredType} from ${inference.source} (${confidenceLabel} confidence)`;
      if (inference.details) {
        reasoning += `. ${inference.details}`;
      }
      // Add evidence summary if available
      if (inference.evidence && inference.evidence.length > 0) {
        const evidenceSummary = inference.evidence
          .slice(0, 3) // Show max 3 pieces of evidence
          .map((e) => e.description)
          .join('; ');
        reasoning += `. Evidence: ${evidenceSummary}`;
      }
    }

    // Build type context for XML output
    const typeContext = buildTypeContext(lineContent, inference);
    const xml = generateTypeContextXml(typeContext);

    return {
      before,
      after,
      reasoning,
      confidence: inference.confidence,
      typeContext,
      xml,
    };
  } catch {
    // Fallback to simple any -> unknown replacement
    const before = lineContent.trim();
    const after = replaceAnyType(lineContent, 'unknown').trim();

    return {
      before,
      after,
      reasoning: 'Safe replacement: unknown requires type guards before use',
      confidence: 100,
    };
  }
}

/**
 * Generate type context XML for an any type issue
 *
 * Convenience function that just returns the XML string.
 *
 * @param context - Suggestion context with file and line info
 * @returns XML string or null if not applicable
 */
export function generateTypeContextXmlForIssue(context: SuggestionContext): string | null {
  const suggestion = generateTypeSafetySuggestion(context);
  return suggestion?.xml ?? null;
}
