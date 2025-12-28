/**
 * @module lib/@patterns/hardcoded/detector
 * @description SWC AST detector for hardcoded values
 *
 * Detects:
 * - Magic numbers (numeric literals not in ACCEPTABLE_NUMBERS)
 * - Hardcoded URLs (string literals with http/https)
 * - Hex colors (string literals matching #[0-9A-Fa-f]{3,6})
 */

import type { Node, Span } from '@swc/core';
// Import from position-utils directly to avoid circular dependency with @swc
import { getContext } from '@/lib/parsing/swc/position-utils';
import type { DetectorContext, HardcodedDetection } from '../detector-types';
import { ACCEPTABLE_NUMBERS, shouldSkipUrl } from './index';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Hex color pattern (3 or 6 characters) */
const HEX_COLOR_PATTERN = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/** URLs to skip detection */
const LOCALHOST_PATTERNS = ['localhost', 'example.com', 'example.org', 'w3.org'] as const;

/** Context keywords indicating intentional configuration */
const CONFIG_KEYWORDS = ['timeout', 'delay'] as const;

/** File patterns that allow colors */
const COLOR_FILE_PATTERNS = ['tailwind', '.css', '.scss'] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if node is inside a const declaration at top level
 *
 * @param node - SWC AST node
 * @param context - Visitor context with parent information
 * @returns True if node is in a top-level SCREAMING_SNAKE_CASE const
 */
export function isInConstDeclaration(node: Node, context: DetectorContext): boolean {
  const nodeType = (node as { type?: string }).type;

  // Check if we're in a top-level const declaration with SCREAMING_SNAKE_CASE
  if (
    nodeType === 'VariableDeclaration' &&
    context.isTopLevel &&
    (node as { kind?: string }).kind === 'const'
  ) {
    const declarations = (node as { declarations?: Array<{ id?: { value?: string } }> })
      .declarations;
    if (declarations && declarations.length > 0) {
      const id = declarations[0]?.id;
      const name = (id as { value?: string })?.value ?? '';
      // SCREAMING_SNAKE_CASE indicates intentional constant
      return /^[A-Z][A-Z0-9_]*$/.test(name);
    }
  }

  return context.inConstDeclaration ?? false;
}

/**
 * Check if numeric literal is in a computed member expression (array index)
 *
 * @param context - Visitor context with parent information
 * @returns True if node is used as array index
 */
export function isArrayIndex(context: DetectorContext): boolean {
  return context.parentType === 'MemberExpression' && context.inMemberExpression === true;
}

/**
 * Check if context contains configuration keywords
 *
 * @param context - Code context string
 * @returns True if context suggests configuration value
 */
function isConfigContext(context: string): boolean {
  const lower = context.toLowerCase();
  return CONFIG_KEYWORDS.some((keyword) => lower.includes(keyword));
}

/**
 * Check if URL should be skipped (localhost, examples, documentation)
 *
 * @param url - URL string to check
 * @returns True if URL should be skipped
 */
function shouldSkipLocalUrl(url: string): boolean {
  return LOCALHOST_PATTERNS.some((pattern) => url.includes(pattern)) || shouldSkipUrl(url);
}

/**
 * Check if file allows color definitions
 *
 * @param filepath - Path to file
 * @returns True if file is a config or style file
 */
function isColorConfigFile(filepath: string): boolean {
  return COLOR_FILE_PATTERNS.some((pattern) => filepath.includes(pattern));
}

// ============================================================================
// MAIN DETECTOR
// ============================================================================

/**
 * Detect hardcoded value from AST node
 *
 * @param node - SWC AST node
 * @param content - File content for context extraction
 * @param filepath - Path to file being analyzed
 * @param context - Current node context
 * @param parentContext - Parent node context (for array index detection)
 * @returns Detection result or null if no issue found
 */
export function detectHardcodedValue(
  node: Node,
  content: string,
  filepath: string,
  context: DetectorContext,
  parentContext: DetectorContext,
): HardcodedDetection | null {
  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (!span) {
    return null;
  }

  // 1. MAGIC NUMBERS - NumericLiteral nodes
  if (nodeType === 'NumericLiteral') {
    return detectMagicNumber(node, content, span, context, parentContext);
  }

  // 2. HARDCODED URLS & HEX COLORS - StringLiteral nodes
  if (nodeType === 'StringLiteral') {
    const value = (node as { value?: string }).value ?? '';

    // Check for URLs first
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return detectHardcodedUrl(value, span);
    }

    // Check for hex colors
    if (HEX_COLOR_PATTERN.test(value)) {
      return detectHexColor(value, filepath, span);
    }
  }

  return null;
}

// ============================================================================
// SPECIALIZED DETECTORS
// ============================================================================

/**
 * Detect magic number specifically
 *
 * @param node - NumericLiteral node
 * @param content - File content
 * @param span - Node span
 * @param context - Current node context
 * @param parentContext - Parent node context
 * @returns Detection or null
 */
export function detectMagicNumber(
  node: Node,
  content: string,
  span: Span,
  context: DetectorContext,
  parentContext: DetectorContext,
): HardcodedDetection | null {
  const value = (node as { value?: number }).value;

  if (value === undefined || ACCEPTABLE_NUMBERS.has(value)) {
    return null;
  }

  // Skip if in const declaration at top-level (intentional constants)
  if (context.inConstDeclaration) {
    return null;
  }

  // Skip array indices (check incoming context from parent)
  if (isArrayIndex(parentContext)) {
    return null;
  }

  // Extract context to check for timeout/delay configurations
  const ctx = getContext(content, span.start, []);

  // Skip timeout/delay contexts (these are typically configuration)
  if (isConfigContext(ctx)) {
    return null;
  }

  return {
    type: 'number',
    value,
    offset: span.start,
  };
}

/**
 * Detect hardcoded URL specifically
 *
 * @param value - URL string
 * @param span - Node span
 * @returns Detection or null
 */
export function detectHardcodedUrl(value: string, span: Span): HardcodedDetection | null {
  // Skip localhost and example URLs
  if (shouldSkipLocalUrl(value)) {
    return null;
  }

  return {
    type: 'url',
    value,
    offset: span.start,
  };
}

/**
 * Detect hex color specifically
 *
 * @param value - Color string
 * @param filepath - Path to file
 * @param span - Node span
 * @returns Detection or null
 */
export function detectHexColor(
  value: string,
  filepath: string,
  span: Span,
): HardcodedDetection | null {
  // Skip tailwind.config and CSS files
  if (isColorConfigFile(filepath)) {
    return null;
  }

  return {
    type: 'color',
    value,
    offset: span.start,
  };
}
