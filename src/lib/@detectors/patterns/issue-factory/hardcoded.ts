/**
 * @module lib/@detectors/issue-factory/hardcoded
 * @description Factory functions for creating hardcoded value representations
 */

import { getContext, offsetToLine } from '@/lib/@ast/swc';
import type { HardcodedDetection } from '../ast/types';
import type { HardcodedValue, IssueFactoryContext } from './types';

// ============================================================================
// HARDCODED VALUE FACTORY
// ============================================================================

/**
 * Create a HardcodedValue from a hardcoded detection
 *
 * Note: This returns HardcodedValue, not QualityIssue.
 * The conversion to QualityIssue happens in the analyzer layer
 * which has access to additional context.
 *
 * @param detection - The hardcoded detection from AST analysis
 * @param ctx - Factory context with file info and content
 * @returns HardcodedValue
 */
export function createHardcodedValue(
  detection: HardcodedDetection,
  ctx: IssueFactoryContext,
): HardcodedValue {
  const adjustedOffset = detection.offset - ctx.baseOffset;
  const lineNumber = offsetToLine(adjustedOffset, ctx.lineOffsets);
  const context = getContext(ctx.content, adjustedOffset, ctx.lineOffsets);

  return {
    value: detection.value,
    type: detection.type,
    line: lineNumber,
    context,
  };
}

/**
 * Create multiple hardcoded values from detections
 */
export function createHardcodedValues(
  detections: HardcodedDetection[],
  ctx: IssueFactoryContext,
): HardcodedValue[] {
  return detections.map((detection) => createHardcodedValue(detection, ctx));
}

// ============================================================================
// HARDCODED VALUE TO ISSUE CONVERSION
// ============================================================================

/** Suggestion messages by hardcoded type */
const HARDCODED_SUGGESTIONS: Record<string, string> = {
  string: 'Move to i18n translations',
  number: 'Extract to named constant',
  url: 'Move to environment variable or config',
  color: 'Extract to theme/constants',
  date: 'Extract to named constant',
};

/**
 * Get suggestion for a hardcoded value type
 */
export function getHardcodedSuggestion(type: string): string {
  return HARDCODED_SUGGESTIONS[type] ?? 'Extract to constants';
}
