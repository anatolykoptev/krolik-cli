/**
 * @module commands/fix/strategies/hardcoded/naming
 * @description Constant name generation from AST context
 */

import { SyntaxKind, NumericLiteral } from 'ts-morph';
import { KNOWN_CONSTANTS, KEYWORD_TO_NAME } from './constants';

// ============================================================================
// STRING UTILITIES
// ============================================================================

/**
 * Convert camelCase or snake_case to SCREAMING_SNAKE_CASE
 */
export function toScreamingSnake(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]/g, '_')
    .toUpperCase();
}

// ============================================================================
// AST CONTEXT EXTRACTION
// ============================================================================

/**
 * Extract context from AST node for better constant naming
 */
export function extractASTContext(node: NumericLiteral): string | null {
  const parent = node.getParent();
  if (!parent) return null;

  // Case 1: Property assignment - `{ foo: 42 }` → extract "foo"
  if (parent.getKind() === SyntaxKind.PropertyAssignment) {
    const propAssign = parent.asKind(SyntaxKind.PropertyAssignment);
    if (propAssign) {
      return propAssign.getName();
    }
  }

  // Case 2: Variable declaration - `const foo = 42` → extract "foo"
  if (parent.getKind() === SyntaxKind.VariableDeclaration) {
    const varDecl = parent.asKind(SyntaxKind.VariableDeclaration);
    if (varDecl) {
      return varDecl.getName();
    }
  }

  // Case 3: Function argument - look for parameter name
  if (parent.getKind() === SyntaxKind.CallExpression) {
    const call = parent.asKind(SyntaxKind.CallExpression);
    if (call) {
      const args = call.getArguments();
      const argIndex = args.findIndex((arg) => arg === node);
      // Try to get function signature for param names (complex, skip for now)
      const funcName = call.getExpression().getText();
      if (funcName && argIndex >= 0) {
        return `${funcName}_arg${argIndex}`;
      }
    }
  }

  // Case 4: Binary expression - `x > 42` → extract "x" comparison
  if (parent.getKind() === SyntaxKind.BinaryExpression) {
    const binary = parent.asKind(SyntaxKind.BinaryExpression);
    if (binary) {
      const left = binary.getLeft();
      if (left.getKind() === SyntaxKind.Identifier) {
        return left.getText();
      }
    }
  }

  // Case 5: Array element - skip, no good context
  if (parent.getKind() === SyntaxKind.ArrayLiteralExpression) {
    return null;
  }

  return null;
}

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
  if (astContext) {
    // Skip generic names like "runKrolik_arg2"
    if (!/^.+_arg\d+$/.test(astContext)) {
      const upper = toScreamingSnake(astContext);
      // Avoid duplicating "VALUE" suffix
      if (upper.endsWith('_VALUE') || upper.endsWith('_COUNT') || upper.endsWith('_SIZE')) {
        return upper;
      }
      return `${upper}_VALUE`;
    }
  }

  // Priority 3: Heuristic based on value
  // Large values (>=1000) in function args are often timeouts
  if (value >= 1000 && value <= 300000) {
    return `TIMEOUT_MS_${value}`;
  }
  if (value >= 1000) {
    return `LARGE_VALUE_${value}`;
  }

  return `MAGIC_${value}`;
}
