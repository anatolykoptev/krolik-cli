/**
 * @module commands/fix/fixers/eval/ast-analyzer
 * @description AST-based analyzer for eval() security risks using ts-morph
 *
 * Uses ts-morph for 100% accurate detection of:
 * - eval() calls
 * - new Function() constructor
 *
 * Benefits over regex:
 * - Correctly skips eval inside strings and comments
 * - Correctly identifies actual function calls vs identifiers
 * - Provides exact byte positions for precise fixes
 */

import { astPool, Node, SyntaxKind } from '@/lib/@ast';
import type { QualityIssue } from '../../core/types';

// ============================================================================
// TYPES
// ============================================================================

export interface EvalLocation {
  line: number;
  column: number;
  startOffset: number;
  endOffset: number;
  kind: 'eval' | 'new-function';
  /** If eval() has a simple variable argument, store the variable name */
  variableName?: string;
}

// ============================================================================
// ANALYZER
// ============================================================================

/**
 * Analyze content for eval() and new Function() usage using ts-morph AST
 */
export function analyzeEvalAST(content: string, file: string): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const lines = content.split('\n');

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Find eval() calls
      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

      for (const callExpr of callExpressions) {
        const expression = callExpr.getExpression();

        // Check for direct eval() call
        if (Node.isIdentifier(expression) && expression.getText() === 'eval') {
          const line = callExpr.getStartLineNumber();
          const lineContent = lines[line - 1] ?? '';

          issues.push({
            file,
            line,
            severity: 'error',
            category: 'type-safety',
            message: 'Security risk: eval() executes arbitrary code',
            suggestion:
              'Replace with JSON.parse() for JSON, or refactor to avoid dynamic code execution',
            snippet: lineContent.trim().slice(0, 60),
            fixerId: 'eval',
          });
        }
      }

      // Find new Function() constructor
      const newExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression);

      for (const newExpr of newExpressions) {
        const expression = newExpr.getExpression();

        // Check for new Function() call
        if (Node.isIdentifier(expression) && expression.getText() === 'Function') {
          const line = newExpr.getStartLineNumber();
          const lineContent = lines[line - 1] ?? '';

          issues.push({
            file,
            line,
            severity: 'warning',
            category: 'type-safety',
            message: 'Security risk: new Function() can execute arbitrary code',
            suggestion: 'Refactor to use regular functions or arrow functions',
            snippet: lineContent.trim().slice(0, 60),
            fixerId: 'eval',
          });
        }
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
 * Find all eval/Function locations with exact positions for fixing
 */
export function findEvalLocations(content: string, file: string): EvalLocation[] {
  const locations: EvalLocation[] = [];

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Find eval() calls
      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

      for (const callExpr of callExpressions) {
        const expression = callExpr.getExpression();

        if (Node.isIdentifier(expression) && expression.getText() === 'eval') {
          // Check if first argument is a simple identifier (variable)
          const args = callExpr.getArguments();
          let variableName: string | undefined;

          if (args.length === 1 && Node.isIdentifier(args[0])) {
            variableName = args[0].getText();
          }

          locations.push({
            line: callExpr.getStartLineNumber(),
            column: callExpr.getStart() - callExpr.getStartLinePos(),
            startOffset: callExpr.getStart(),
            endOffset: callExpr.getEnd(),
            kind: 'eval',
            ...(variableName !== undefined && { variableName }),
          });
        }
      }

      // Find new Function() constructor
      const newExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression);

      for (const newExpr of newExpressions) {
        const expression = newExpr.getExpression();

        if (Node.isIdentifier(expression) && expression.getText() === 'Function') {
          locations.push({
            line: newExpr.getStartLineNumber(),
            column: newExpr.getStart() - newExpr.getStartLinePos(),
            startOffset: newExpr.getStart(),
            endOffset: newExpr.getEnd(),
            kind: 'new-function',
          });
        }
      }

      return locations;
    } finally {
      cleanup();
    }
  } catch {
    return [];
  }
}
