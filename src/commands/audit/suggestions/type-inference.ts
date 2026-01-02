/**
 * @module commands/audit/suggestions/type-inference
 * @description Type inference from usage patterns
 *
 * Analyzes how variables are used to infer their types.
 * Uses SWC for fast AST parsing.
 *
 * @example
 * ```typescript
 * import { inferTypeFromUsage } from './type-inference';
 *
 * const result = inferTypeFromUsage(ast, lineOffsets, baseOffset, line, content);
 * // result: { inferredType: 'unknown', confidence: 100, source: 'fallback' }
 * ```
 *
 * @example XML output
 * ```typescript
 * import { generateTypeContextXml } from './type-inference';
 *
 * const xml = generateTypeContextXml(typeContext);
 * // Returns:
 * // <type-context>
 * //   <current>function parse(data: any)</current>
 * //   <inferred-type confidence="75%">Record&lt;string, unknown&gt;</inferred-type>
 * //   <evidence>
 * //     <usage>Object.keys(data) called</usage>
 * //   </evidence>
 * //   <suggested-fix>function parse(data: Record&lt;string, unknown&gt;)</suggested-fix>
 * // </type-context>
 * ```
 */

import type { Module } from '@swc/core';
import type { ConfidenceLevel, TypeContext } from './types';
import {
  analyzeUsages,
  CONFIDENCE_SCORES,
  type EnhancedTypeInferenceResult,
  findVariableUsages,
} from './usage-analysis';

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Infer type from how a variable is used in the code
 *
 * Analyzes the AST to find usage patterns of the variable
 * on the given line and infers the most likely type.
 *
 * @param ast - Parsed SWC AST module
 * @param lineOffsets - Line offset mapping for position calculation
 * @param baseOffset - Base offset for SWC span normalization
 * @param targetLine - Line number where the `any` type is declared
 * @param content - Full file content
 * @returns Type inference result with confidence and evidence
 *
 * @example
 * ```typescript
 * const { ast, lineOffsets, baseOffset } = parseFile(filePath, content);
 * const result = inferTypeFromUsage(ast, lineOffsets, baseOffset, 10, content);
 * console.log(result.inferredType); // 'string' or 'unknown'
 * console.log(result.evidence); // Array of evidence supporting the inference
 * ```
 */
export function inferTypeFromUsage(
  ast: Module,
  lineOffsets: number[],
  baseOffset: number,
  targetLine: number,
  content: string,
): EnhancedTypeInferenceResult {
  // Extract variable name from the line with `any`
  const lines = content.split('\n');
  if (targetLine < 1 || targetLine > lines.length) {
    return createFallbackResult();
  }

  const line = lines[targetLine - 1];
  if (!line) {
    return createFallbackResult();
  }

  const variableName = extractVariableName(line);

  if (!variableName) {
    return createFallbackResult();
  }

  // Find all usages of this variable in the file
  const usages = findVariableUsages(ast, variableName, lineOffsets, baseOffset);

  // Analyze usages to infer type
  const inferredType = analyzeUsages(usages, variableName);

  if (inferredType) {
    return inferredType;
  }

  // Default fallback to unknown (always safe)
  return createFallbackResult();
}

/**
 * Build a complete TypeContext for an `any` type issue
 *
 * Combines the original code, inferred type, evidence, and suggested fix.
 *
 * @param lineContent - Original line containing `any` type
 * @param inference - Type inference result
 * @returns Complete type context for XML output
 */
export function buildTypeContext(
  lineContent: string,
  inference: EnhancedTypeInferenceResult,
): TypeContext {
  return {
    current: lineContent.trim(),
    inferredType: inference.inferredType,
    confidence: inference.confidence,
    evidence: inference.evidence,
    suggestedFix: replaceAnyType(lineContent, inference.inferredType).trim(),
  };
}

/**
 * Generate XML representation of type context
 *
 * Creates an XML string suitable for AI-friendly output.
 *
 * @param context - TypeContext to format
 * @returns XML string representation
 *
 * @example
 * ```xml
 * <type-context>
 *   <current>function parse(data: any)</current>
 *   <inferred-type confidence="75%">Record&lt;string, unknown&gt;</inferred-type>
 *   <evidence>
 *     <usage>Object.keys(data) called</usage>
 *     <usage>data.id accessed</usage>
 *   </evidence>
 *   <suggested-fix>function parse(data: Record&lt;string, unknown&gt;)</suggested-fix>
 * </type-context>
 * ```
 */
export function generateTypeContextXml(context: TypeContext): string {
  const lines: string[] = [];

  lines.push('<type-context>');
  lines.push(`  <current>${escapeXml(context.current)}</current>`);
  lines.push(
    `  <inferred-type confidence="${context.confidence}%">${escapeXml(context.inferredType)}</inferred-type>`,
  );

  if (context.evidence.length > 0) {
    lines.push('  <evidence>');
    for (const ev of context.evidence) {
      const lineAttr = ev.line !== undefined ? ` line="${ev.line}"` : '';
      lines.push(`    <usage${lineAttr}>${escapeXml(ev.description)}</usage>`);
    }
    lines.push('  </evidence>');
  }

  lines.push(`  <suggested-fix>${escapeXml(context.suggestedFix)}</suggested-fix>`);
  lines.push('</type-context>');

  return lines.join('\n');
}

/**
 * Infer type and generate XML output in one call
 *
 * Convenience function that combines inference and XML generation.
 *
 * @param ast - Parsed SWC AST module
 * @param lineOffsets - Line offset mapping
 * @param baseOffset - Base offset for span normalization
 * @param targetLine - Line number with `any` type
 * @param content - Full file content
 * @returns XML string with type context, or null if no inference possible
 */
export function inferAndGenerateXml(
  ast: Module,
  lineOffsets: number[],
  baseOffset: number,
  targetLine: number,
  content: string,
): string | null {
  const lines = content.split('\n');
  if (targetLine < 1 || targetLine > lines.length) {
    return null;
  }

  const lineContent = lines[targetLine - 1];
  if (!lineContent || !hasAnyType(lineContent)) {
    return null;
  }

  const inference = inferTypeFromUsage(ast, lineOffsets, baseOffset, targetLine, content);
  const context = buildTypeContext(lineContent, inference);

  return generateTypeContextXml(context);
}

/**
 * Check if a line contains an `any` type annotation
 *
 * @param line - Line of code to check
 * @returns true if line contains `: any` or `as any`
 */
export function hasAnyType(line: string): boolean {
  // Match `: any` with word boundaries (not `someany` or `anything`)
  const colonAnyPattern = /:\s*any\b/;
  // Match `as any` for type assertions
  const asAnyPattern = /\bas\s+any\b/;

  return colonAnyPattern.test(line) || asAnyPattern.test(line);
}

/**
 * Replace `any` type with inferred type in a line
 *
 * @param line - Original line of code
 * @param newType - Type to replace `any` with
 * @returns Modified line with new type
 */
export function replaceAnyType(line: string, newType: string): string {
  // Replace `: any` keeping the colon
  let result = line.replace(/:\s*any\b/, `: ${newType}`);

  // Replace `as any` keeping the `as`
  result = result.replace(/\bas\s+any\b/, `as ${newType}`);

  return result;
}

/**
 * Get confidence label for display
 */
export function getConfidenceLabel(confidence: ConfidenceLevel): string {
  if (confidence >= 90) return 'very high';
  if (confidence >= 75) return 'high';
  if (confidence >= 50) return 'medium';
  if (confidence >= 25) return 'low';
  return 'very low';
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Create a fallback result with `unknown` type
 */
function createFallbackResult(): EnhancedTypeInferenceResult {
  return {
    inferredType: 'unknown',
    confidence: CONFIDENCE_SCORES.fallback,
    source: 'fallback',
    details: 'Safe replacement: unknown requires type guards before use',
    evidence: [],
  };
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Extract variable name from a line with type annotation
 *
 * @example
 * 'const handler: any = ...' -> 'handler'
 * 'let x: any;' -> 'x'
 * 'function foo(x: any)' -> 'x'
 */
function extractVariableName(line: string): string | null {
  // Match variable declarations: const/let/var name: any
  const varMatch = line.match(/(?:const|let|var)\s+(\w+)\s*:\s*any\b/);
  if (varMatch?.[1]) {
    return varMatch[1];
  }

  // Match function parameters: (name: any) or name: any,
  const paramMatch = line.match(/\(?\s*(\w+)\s*:\s*any\b/);
  if (paramMatch?.[1]) {
    return paramMatch[1];
  }

  // Match property: name: any in objects/interfaces
  const propMatch = line.match(/^\s*(\w+)\s*:\s*any\b/);
  if (propMatch?.[1]) {
    return propMatch[1];
  }

  return null;
}
