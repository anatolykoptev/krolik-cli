/**
 * @module commands/fix/fixers/equality/ast-fixer
 * @description AST-based fixer for loose equality using ts-morph
 *
 * Uses ts-morph for 100% accurate fixes:
 * - Exact byte offsets for precise replacement
 * - Validates replacement is safe before applying
 */

import { astPool, getLineStartOffset, SyntaxKind } from '@/lib/@ast';
import type { FixOperation, QualityIssue } from '../../core/types';

/**
 * Fix a loose equality issue by replacing with strict equality
 *
 * Uses ts-morph AST for precise replacement at exact positions.
 */
export function fixEqualityIssueAST(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];

  if (line === undefined) return null;

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, issue.file);

    try {
      // Find binary expressions on this line
      const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const lineBinaryExprs = binaryExpressions.filter(
        (expr) => expr.getOperatorToken().getStartLineNumber() === issue.line,
      );

      if (lineBinaryExprs.length === 0) {
        return null;
      }

      // Find the loose equality operator(s) to replace
      const lineStartOffset = getLineStartOffset(content, issue.line);
      let newLine = line;

      // Sort by position descending to maintain offsets during replacement
      const sortedExprs = [...lineBinaryExprs].sort(
        (a, b) => b.getOperatorToken().getStart() - a.getOperatorToken().getStart(),
      );

      for (const binaryExpr of sortedExprs) {
        const operatorToken = binaryExpr.getOperatorToken();
        const operatorKind = operatorToken.getKind();

        let strictOperator: string | undefined;

        if (operatorKind === SyntaxKind.EqualsEqualsToken) {
          strictOperator = '===';
        } else if (operatorKind === SyntaxKind.ExclamationEqualsToken) {
          strictOperator = '!==';
        }

        if (!strictOperator) continue;

        const start = operatorToken.getStart() - lineStartOffset;
        const end = operatorToken.getEnd() - lineStartOffset;

        // Validate we're replacing the expected operator
        const currentOp = line.slice(start, end);
        if (currentOp === '==' || currentOp === '!=') {
          newLine = newLine.slice(0, start) + strictOperator + newLine.slice(end);
        }
      }

      if (newLine === line) {
        return null;
      }

      return {
        action: 'replace-line',
        file: issue.file,
        line: issue.line,
        oldCode: line,
        newCode: newLine,
      };
    } finally {
      cleanup();
    }
  } catch {
    return null;
  }
}

/**
 * Batch fix: Replace all loose equality with strict equality in a file
 *
 * More efficient than fixing line-by-line for files with many issues.
 * Returns the modified content directly.
 */
export function fixAllEqualityInFile(content: string, file: string): string | null {
  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, file);

    try {
      // Find all binary expressions with loose equality
      const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);

      const looseEqualityOps: Array<{
        start: number;
        end: number;
        strictOp: string;
      }> = [];

      for (const binaryExpr of binaryExpressions) {
        const operatorToken = binaryExpr.getOperatorToken();
        const operatorKind = operatorToken.getKind();

        let strictOperator: string | undefined;

        if (operatorKind === SyntaxKind.EqualsEqualsToken) {
          strictOperator = '===';
        } else if (operatorKind === SyntaxKind.ExclamationEqualsToken) {
          strictOperator = '!==';
        }

        if (strictOperator) {
          looseEqualityOps.push({
            start: operatorToken.getStart(),
            end: operatorToken.getEnd(),
            strictOp: strictOperator,
          });
        }
      }

      if (looseEqualityOps.length === 0) {
        return null;
      }

      // Sort by position descending for safe replacement
      looseEqualityOps.sort((a, b) => b.start - a.start);

      let newContent = content;

      for (const op of looseEqualityOps) {
        newContent = newContent.slice(0, op.start) + op.strictOp + newContent.slice(op.end);
      }

      return newContent !== content ? newContent : null;
    } finally {
      cleanup();
    }
  } catch {
    return null;
  }
}
