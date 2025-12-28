/**
 * @module lib/parsing/signatures/text-extraction
 * @description Pure text extraction functions for signature parsing
 *
 * These functions extract signature text from source code content.
 * They are pure (no side effects) and can be used independently of AST.
 *
 * @example
 * import { extractSignatureText, findSignatureEnd } from '@/lib/parsing/signatures';
 *
 * const sigText = extractSignatureText(content, startOffset, endOffset, 200);
 * // Returns: 'function parseDate(str: string): Date'
 */

import {
  ARROW_OPERATOR,
  ASSIGNMENT_OPERATOR,
  BODY_START_BRACE,
  BRACKET_DELTAS,
  SWC_OFFSET_BASE,
  TRUNCATION_SUFFIX,
  TRUNCATION_SUFFIX_LENGTH,
} from './constants';

// ============================================================================
// SIGNATURE TEXT EXTRACTION
// ============================================================================

/**
 * Extract signature text from AST node span
 *
 * Extracts only the signature part (without the body) from a function,
 * class, or type declaration. Handles multi-line parameters by collapsing
 * them to a single line.
 *
 * @param content - Source file content
 * @param startOffset - Start offset (SWC 1-based)
 * @param endOffset - End offset (SWC 1-based)
 * @param maxLength - Maximum length before truncation
 * @returns Signature text without body, collapsed to single line
 *
 * @example
 * const sig = extractSignatureText(content, 100, 200, 200);
 * // Returns: 'function parseDate(str: string): Date'
 *
 * @example
 * // Multi-line parameters are collapsed
 * const sig = extractSignatureText(multiLineContent, 50, 150, 200);
 * // Returns: 'function create( name: string, options: Options ): Result'
 */
export function extractSignatureText(
  content: string,
  startOffset: number,
  endOffset: number,
  maxLength: number,
): string {
  // SWC offsets are 1-based, convert to 0-based
  const start = startOffset - SWC_OFFSET_BASE;
  const end = endOffset - SWC_OFFSET_BASE;

  if (start < 0 || end > content.length || start >= end) {
    return '';
  }

  const nodeText = content.slice(start, end);

  // Find the signature part (up to first { or end of first line)
  const openBraceIndex = findSignatureEnd(nodeText);
  let signatureText = nodeText.slice(0, openBraceIndex).trim();

  // Handle multi-line parameters - collapse to single line
  signatureText = signatureText.replace(/\s+/g, ' ');

  // Truncate if too long
  if (signatureText.length > maxLength) {
    signatureText = `${signatureText.slice(0, maxLength - TRUNCATION_SUFFIX_LENGTH)}${TRUNCATION_SUFFIX}`;
  }

  return signatureText;
}

/**
 * Find the end of the signature (before the body)
 *
 * Scans the text to find where the signature ends and the body begins.
 * Handles nested brackets to avoid false positives inside generics or parameters.
 *
 * @param text - Source text starting from declaration
 * @returns Index where the body starts, or text.length if no body found
 *
 * @example
 * findSignatureEnd('function foo() { return 1; }')
 * // Returns: 15 (position of '{')
 *
 * @example
 * findSignatureEnd('const f = () => { x }')
 * // Returns: 17 (position of '{' after arrow)
 *
 * @example
 * findSignatureEnd('const f = () => x + 1')
 * // Returns: 21 (expression body, include whole thing)
 */
export function findSignatureEnd(text: string): number {
  let parenDepth = 0;
  let angleDepth = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === undefined) continue;

    // Update bracket depth
    const delta = BRACKET_DELTAS[char];
    if (delta) {
      parenDepth += delta[0];
      angleDepth += delta[1];
      continue;
    }

    // Only check for body start at top level
    if (parenDepth !== 0 || angleDepth !== 0) continue;

    // Check for body start
    const bodyStart = findBodyStartAt(text, i, char);
    if (bodyStart !== -1) return bodyStart;
  }

  return text.length;
}

/**
 * Check if current position is the start of a function body
 *
 * @param text - Full source text
 * @param index - Current character index
 * @param char - Character at current index
 * @returns Index of body start, or -1 if not a body start
 *
 * @example
 * findBodyStartAt('fn() { }', 5, '{')
 * // Returns: 5 (brace position)
 *
 * @example
 * findBodyStartAt('f = () => { }', 7, '=')
 * // Returns: 10 (brace after arrow)
 */
export function findBodyStartAt(text: string, index: number, char: string): number {
  // Opening brace - function body starts
  if (char === BODY_START_BRACE) return index;

  // Arrow function (=> sequence)
  if (char === '=' && text[index + 1] === '>') {
    const afterArrow = text.slice(index + ARROW_OPERATOR.length).trimStart();
    if (afterArrow.startsWith(BODY_START_BRACE)) {
      return text.indexOf(BODY_START_BRACE, index);
    }
    // Expression body - include the whole thing
    return text.length;
  }

  return -1;
}

// ============================================================================
// FIRST LINE EXTRACTION
// ============================================================================

/**
 * Extract only the first line of a declaration
 *
 * Used for type aliases where the signature is typically a single line.
 *
 * @param content - Source file content
 * @param startOffset - Start offset (SWC 1-based)
 * @param maxLength - Maximum length before truncation
 * @returns First line, trimmed and truncated
 *
 * @example
 * extractFirstLine('type Foo = {\n  bar: string\n}', 1, 200)
 * // Returns: 'type Foo = {'
 */
export function extractFirstLine(content: string, startOffset: number, maxLength: number): string {
  const start = startOffset - SWC_OFFSET_BASE;
  if (start < 0 || start >= content.length) return '';

  let endIndex = content.indexOf('\n', start);
  if (endIndex === -1) endIndex = content.length;

  let line = content.slice(start, endIndex).trim();

  if (line.length > maxLength) {
    line = `${line.slice(0, maxLength - TRUNCATION_SUFFIX_LENGTH)}${TRUNCATION_SUFFIX}`;
  }

  return line;
}

// ============================================================================
// DECLARATION LINE EXTRACTION
// ============================================================================

/**
 * Extract class/interface declaration line (up to first brace)
 *
 * Extracts the declaration header without the body.
 * Collapses multi-line extends/implements clauses to single line.
 *
 * @param content - Source file content
 * @param startOffset - Start offset (SWC 1-based)
 * @param maxLength - Maximum length before truncation
 * @returns Declaration line without body
 *
 * @example
 * extractDeclarationLine('class Foo extends Bar {\n  method() {}\n}', 1, 200)
 * // Returns: 'class Foo extends Bar'
 */
export function extractDeclarationLine(
  content: string,
  startOffset: number,
  maxLength: number,
): string {
  const start = startOffset - SWC_OFFSET_BASE;
  if (start < 0 || start >= content.length) return '';

  let braceIndex = content.indexOf(BODY_START_BRACE, start);
  if (braceIndex === -1) braceIndex = content.length;

  let text = content.slice(start, braceIndex).trim();
  text = text.replace(/\s+/g, ' ');

  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength - TRUNCATION_SUFFIX_LENGTH)}${TRUNCATION_SUFFIX}`;
  }

  return text;
}

/**
 * Extract const with type annotation (up to assignment)
 *
 * For const declarations with type annotations, extract only the
 * name and type, not the value.
 *
 * @param content - Source file content
 * @param startOffset - Start offset (SWC 1-based)
 * @param endOffset - End offset (SWC 1-based)
 * @param maxLength - Maximum length before truncation
 * @returns Declaration without the value part
 *
 * @example
 * extractConstTypeSignature('config: Config = { ... }', 1, 50, 200)
 * // Returns: 'config: Config'
 */
export function extractConstTypeSignature(
  content: string,
  startOffset: number,
  endOffset: number,
  maxLength: number,
): string {
  const start = startOffset - SWC_OFFSET_BASE;
  if (start < 0) return '';

  const text = content.slice(start, endOffset - SWC_OFFSET_BASE);

  // Find = sign (end of signature)
  const eqIndex = text.indexOf(ASSIGNMENT_OPERATOR);
  if (eqIndex === -1) return extractFirstLine(content, startOffset, maxLength);

  let signature = text.slice(0, eqIndex).trim();
  signature = signature.replace(/\s+/g, ' ');

  if (signature.length > maxLength) {
    signature = `${signature.slice(0, maxLength - TRUNCATION_SUFFIX_LENGTH)}${TRUNCATION_SUFFIX}`;
  }

  return signature;
}
