/**
 * @module commands/fix/fixers/magic-numbers/ast-analyzer
 * @description AST-based analyzer for magic numbers using ts-morph
 *
 * Uses ts-morph for accurate detection of:
 * - Numeric literals in expressions (not in declarations)
 * - Skips numbers in const/let/var declarations (they define constants)
 * - Skips numbers in enums, type definitions, array indices
 * - Handles template literals and string contexts correctly
 */

import { Node, type NumericLiteral, SyntaxKind } from 'ts-morph';
import { astPool } from '@/lib/@ast';
import type { QualityIssue } from '../../core/types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Allowed numbers that don't need extraction
const ALLOWED_NUMBERS = new Set([0, 1, 2, -1, 10, 100, 1000]);

// Common HTTP status codes
const HTTP_STATUS_CODES = new Set([
  200, 201, 202, 204, 301, 302, 304, 400, 401, 403, 404, 405, 409, 422, 429, 500, 501, 502, 503,
]);

// Common port numbers
const PORT_NUMBERS = new Set([80, 443, 3000, 3001, 4000, 5000, 5173, 8000, 8080, 8443, 9000]);

// Time constants (ms)
const TIME_CONSTANTS = new Set([
  1000, // 1 second
  60000, // 1 minute
  3600000, // 1 hour
  86400000, // 1 day
]);

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Analyze content for magic numbers using ts-morph AST
 */
export function analyzeMagicNumbersAST(content: string, file: string): QualityIssue[] {
  // Skip config and test files
  if (
    file.includes('.config.') ||
    file.includes('.test.') ||
    file.includes('.spec.') ||
    file.endsWith('.d.ts')
  ) {
    return [];
  }

  // Skip non-TypeScript files
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) {
    return [];
  }

  const issues: QualityIssue[] = [];
  const lines = content.split('\n');
  const seenLocations = new Set<string>(); // Prevent duplicates

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Find all numeric literals
      const numericLiterals = sourceFile.getDescendantsOfKind(SyntaxKind.NumericLiteral);

      for (const literal of numericLiterals) {
        const value = literal.getLiteralValue();
        const { line, column } = sourceFile.getLineAndColumnAtPos(literal.getStart());

        // Skip duplicates
        const locationKey = `${line}:${column}`;
        if (seenLocations.has(locationKey)) continue;
        seenLocations.add(locationKey);

        // Skip allowed numbers
        if (shouldSkipNumber(value)) continue;

        // Skip if in a valid context
        if (isInAllowedContext(literal)) continue;

        const lineContent = lines[line - 1] ?? '';

        issues.push({
          file,
          line,
          severity: 'warning',
          category: 'hardcoded',
          message: `Hardcoded number: ${value}`,
          suggestion: 'Extract to a named constant',
          snippet: lineContent.trim().slice(0, 60),
          fixerId: 'magic-numbers',
        });
      }

      return issues;
    } finally {
      cleanup();
    }
  } catch {
    // Fallback to simple regex analysis
    return analyzeMagicNumbersFallback(content, file);
  }
}

/**
 * Check if a number should be skipped based on its value
 */
function shouldSkipNumber(value: number): boolean {
  // Small common numbers
  if (ALLOWED_NUMBERS.has(value)) return true;

  // HTTP status codes
  if (HTTP_STATUS_CODES.has(value)) return true;

  // Port numbers
  if (PORT_NUMBERS.has(value)) return true;

  // Time constants
  if (TIME_CONSTANTS.has(value)) return true;

  // Single digit numbers
  if (value >= -9 && value <= 9) return true;

  // Common percentages
  if ([25, 50, 75, 100].includes(value)) return true;

  // Common sizes in powers of 2
  if ([16, 32, 64, 128, 256, 512, 1024, 2048, 4096].includes(value)) return true;

  return false;
}

/**
 * Check if a numeric literal is in an allowed context
 */
function isInAllowedContext(literal: NumericLiteral): boolean {
  const parent = literal.getParent();
  if (!parent) return false;

  // 1. Variable/const declaration with initializer
  // e.g., const MAX_SIZE = 100
  if (Node.isVariableDeclaration(parent)) {
    return true;
  }

  // 2. Property assignment in object literal
  // e.g., { timeout: 5000 }
  if (Node.isPropertyAssignment(parent)) {
    const propName = parent.getName().toLowerCase();
    // Skip timeout/delay/interval properties
    if (/timeout|delay|interval|duration|retries|attempts|limit|max|min/.test(propName)) {
      return true;
    }
  }

  // 3. Enum member
  if (Node.isEnumMember(parent)) {
    return true;
  }

  // 4. Array access expression (index)
  // e.g., arr[0], arr[1]
  if (Node.isElementAccessExpression(parent)) {
    return true;
  }

  // 5. Type literal (type annotation)
  // e.g., type Port = 8080
  const typeParent = literal.getFirstAncestorByKind(SyntaxKind.TypeLiteral);
  if (typeParent) {
    return true;
  }

  // 6. Default parameter value
  // e.g., function foo(x = 10)
  if (Node.isParameterDeclaration(parent)) {
    return true;
  }

  // 7. Inside return statement returning just the number
  // e.g., return 0; return 1;
  if (Node.isReturnStatement(parent)) {
    return true;
  }

  // 8. In a comparison with obvious meaning
  // e.g., x > 0, x === 0, arr.length === 0
  if (Node.isBinaryExpression(parent)) {
    const left = parent.getLeft();
    const right = parent.getRight();
    const operator = parent.getOperatorToken().getText();

    // Comparison operators
    if (['===', '!==', '==', '!=', '<', '>', '<=', '>='].includes(operator)) {
      // Common comparisons: x > 0, length === 0, etc.
      const otherSide = left === literal ? right : left;
      const otherText = otherSide.getText().toLowerCase();
      if (
        otherText.includes('length') ||
        otherText.includes('count') ||
        otherText.includes('size')
      ) {
        return true;
      }
    }
  }

  // 9. In array/tuple type
  // e.g., [string, number, number]
  const tupleType = literal.getFirstAncestorByKind(SyntaxKind.TupleType);
  if (tupleType) {
    return true;
  }

  // 10. In test assertions
  // e.g., expect(x).toBe(5)
  const callExpr = literal.getFirstAncestorByKind(SyntaxKind.CallExpression);
  if (callExpr) {
    const callText = callExpr.getExpression().getText();
    if (/expect|assert|toBe|toEqual|toHaveLength/.test(callText)) {
      return true;
    }
  }

  // 11. Prefixed with minus (negative number in declaration)
  if (Node.isPrefixUnaryExpression(parent)) {
    const grandParent = parent.getParent();
    if (grandParent && Node.isVariableDeclaration(grandParent)) {
      return true;
    }
  }

  return false;
}

/**
 * Fallback regex-based analysis for files that fail to parse
 */
function analyzeMagicNumbersFallback(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  const MAGIC_NUMBER_PATTERN = /(?<![\w.])\b(\d{2,})\b(?![\w])/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const trimmed = line.trim();

    // Skip comments and const declarations
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;
    if (trimmed.startsWith('const ') && trimmed.includes('=')) continue;

    // Strip comments before matching
    const codeOnly = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');

    MAGIC_NUMBER_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = MAGIC_NUMBER_PATTERN.exec(codeOnly)) !== null) {
      const num = parseInt(match[1] ?? '0', 10);

      if (shouldSkipNumber(num)) continue;

      issues.push({
        file,
        line: i + 1,
        severity: 'warning',
        category: 'hardcoded',
        message: `Hardcoded number: ${num}`,
        suggestion: 'Extract to a named constant',
        snippet: trimmed.slice(0, 60),
        fixerId: 'magic-numbers',
      });
    }
  }

  return issues;
}
