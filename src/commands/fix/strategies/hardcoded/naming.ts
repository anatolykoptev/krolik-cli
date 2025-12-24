/**
 * @module commands/fix/strategies/hardcoded/naming
 * @description Constant name generation logic
 */

import { KEYWORD_TO_NAME, KNOWN_CONSTANTS } from './constants';

const VALUE_VALUE = 300000;

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Convert camelCase or snake_case to SCREAMING_SNAKE_CASE
 * Sanitizes input to only contain valid identifier characters
 */
export function toScreamingSnake(str: string): string {
  // Extract only valid identifier parts (handle dot notation like "router.procedures")
  const parts = str.split(/[.[\]()]/);
  const lastPart = parts.filter(Boolean).pop() || str;

  // Only keep valid identifier characters
  const sanitized = lastPart.replace(/[^a-zA-Z0-9_]/g, '');

  if (!sanitized) return 'VALUE';

  return sanitized
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]/g, '_')
    .toUpperCase();
}

/** Pattern for generic arg names like "fn_arg0" */
const GENERIC_ARG_PATTERN = /^.+_arg\d+$/;

/** Suffixes that already indicate the type */
const VALUE_SUFFIXES = ['_VALUE', '_COUNT', '_SIZE'] as const;

// ============================================================================
// CONSTANT NAME GENERATION
// ============================================================================

/**
 * Generate a meaningful constant name from context
 *
 * Priority order:
 * 0. Known constants (HTTP codes, log levels, ports)
 * 1. Keyword matching from snippet/message
 * 2. AST context (property/variable names)
 * 3. Heuristic based on value
 */
export function generateConstName(
  value: number,
  context: string,
  astContext: string | null,
): string {
  // Priority 0: Known constants (HTTP codes, log levels, ports, etc.)
  const knownName = KNOWN_CONSTANTS[value];
  if (knownName) {
    return knownName;
  }

  const lower = context.toLowerCase();

  // Priority 1: Keyword matching from snippet/message (most semantic)
  for (const [keyword, name] of Object.entries(KEYWORD_TO_NAME)) {
    if (lower.includes(keyword)) {
      return name;
    }
  }

  // Priority 2: AST context (if no keyword match)
  if (astContext && !GENERIC_ARG_PATTERN.test(astContext)) {
    const upper = toScreamingSnake(astContext);
    // Avoid duplicating suffixes like "_VALUE", "_COUNT", "_SIZE"
    const hasValueSuffix = VALUE_SUFFIXES.some((suffix) => upper.endsWith(suffix));
    return hasValueSuffix ? upper : `${upper}_VALUE`;
  }

  // Priority 3: Heuristic based on value
  // Large values (>=1000) in function args are often timeouts
  if (value >= 1000 && value <= VALUE_VALUE) {
    return `TIMEOUT_MS_${value}`;
  }
  if (value >= 1000) {
    return `LARGE_VALUE_${value}`;
  }

  return `MAGIC_${value}`;
}
