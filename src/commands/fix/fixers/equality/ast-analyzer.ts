/**
 * @module commands/fix/fixers/equality/ast-analyzer
 * @description AST-based analyzer for loose equality operators using ts-morph
 *
 * Uses ts-morph for 100% accurate detection of loose equality:
 * - BinaryExpression with EqualsEqualsToken (==)
 * - BinaryExpression with ExclamationEqualsToken (!=)
 *
 * Benefits over regex:
 * - Correctly skips operators inside strings
 * - Correctly skips operators inside comments
 * - Provides exact byte positions for precise fixes
 */

import { astPool, SyntaxKind } from '@/lib/@ast';
import type { QualityIssue } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface LooseEqualityLocation {
  line: number;
  column: number;
  startOffset: number;
  endOffset: number;
  operator: '==' | '!=';
  strictOperator: '===' | '!==';
}

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Analyze content for loose equality operators using ts-morph AST
 */
export function analyzeEqualityAST(content: string, file: string): QualityIssue[] {
  // Skip test files
  if (file.includes('.test.') || file.includes('.spec.') || file.includes('__tests__')) {
    return [];
  }

  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Find all binary expressions
      const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);

      // Track seen lines to avoid duplicate issues per line
      const seenLines = new Set<number>();

      for (const binaryExpr of binaryExpressions) {
        const operatorToken = binaryExpr.getOperatorToken();
        const operatorKind = operatorToken.getKind();

        // Check for loose equality
        let operator: '==' | '!=' | undefined;
        let strictOperator: '===' | '!==' | undefined;

        if (operatorKind === SyntaxKind.EqualsEqualsToken) {
          operator = '==';
          strictOperator = '===';
        } else if (operatorKind === SyntaxKind.ExclamationEqualsToken) {
          operator = '!=';
          strictOperator = '!==';
        }

        if (!operator || !strictOperator) continue;

        const line = operatorToken.getStartLineNumber();

        // Avoid duplicate issues for same line (multiple operators)
        if (seenLines.has(line)) continue;
        seenLines.add(line);

        const lineContent = lines[line - 1] ?? '';
        const trimmed = lineContent.trim();

        issues.push({
          file,
          line,
          severity: 'warning',
          category: 'type-safety',
          message: `Use strict equality '${strictOperator}' instead of '${operator}'`,
          suggestion: `Replace '${operator}' with '${strictOperator}' for type-safe comparison`,
          snippet: trimmed.slice(0, 60),
          fixerId: 'equality',
        });
      }

      return issues;
    } finally {
      cleanup();
    }
  } catch {
    // If parsing fails, return empty (file has syntax errors)
    return [];
  }
}

/**
 * Find all loose equality operator locations with exact positions for fixing
 */
export function findLooseEqualityLocations(content: string, file: string): LooseEqualityLocation[] {
  const locations: LooseEqualityLocation[] = [];

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Find all binary expressions
      const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);

      for (const binaryExpr of binaryExpressions) {
        const operatorToken = binaryExpr.getOperatorToken();
        const operatorKind = operatorToken.getKind();

        // Check for loose equality
        let operator: '==' | '!=' | undefined;
        let strictOperator: '===' | '!==' | undefined;

        if (operatorKind === SyntaxKind.EqualsEqualsToken) {
          operator = '==';
          strictOperator = '===';
        } else if (operatorKind === SyntaxKind.ExclamationEqualsToken) {
          operator = '!=';
          strictOperator = '!==';
        }

        if (!operator || !strictOperator) continue;

        locations.push({
          line: operatorToken.getStartLineNumber(),
          column: operatorToken.getStart() - operatorToken.getStartLinePos(),
          startOffset: operatorToken.getStart(),
          endOffset: operatorToken.getEnd(),
          operator,
          strictOperator,
        });
      }

      return locations;
    } finally {
      cleanup();
    }
  } catch {
    return [];
  }
}
