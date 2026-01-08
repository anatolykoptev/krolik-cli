/**
 * @module commands/fix/fixers/eval/ast-fixer
 * @description AST-based fixer for eval() security risks using ts-morph
 *
 * Uses ts-morph for precise detection and safer fixes:
 * - Converts eval(jsonVar) to JSON.parse(jsonVar) when variable name suggests JSON
 * - Adds TODO comment for complex cases
 */

import { astPool, Node, SyntaxKind } from '@/lib/@ast';
import type { FixOperation, QualityIssue } from '../../core/types';

/**
 * Fix an eval issue using AST analysis
 *
 * Strategy:
 * 1. Find the eval/Function call at the issue line
 * 2. For simple eval(variable) where variable name suggests JSON, convert to JSON.parse
 * 3. For complex cases, add a TODO comment
 */
export function fixEvalIssueAST(issue: QualityIssue, content: string): FixOperation | null {
  if (!issue.line || !issue.file) return null;

  const lines = content.split('\n');
  const lineIndex = issue.line - 1;
  const line = lines[lineIndex];

  if (line === undefined) return null;

  // Skip new Function() - always add TODO comment
  if (issue.message.includes('new Function')) {
    return addTodoComment(issue, line);
  }

  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, issue.file);

    try {
      // Find eval calls on this line
      const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
      const lineEvalCalls = callExpressions.filter((call) => {
        const expr = call.getExpression();
        return (
          Node.isIdentifier(expr) &&
          expr.getText() === 'eval' &&
          call.getStartLineNumber() === issue.line
        );
      });

      if (lineEvalCalls.length === 0) {
        return addTodoComment(issue, line);
      }

      const evalCall = lineEvalCalls[0];
      if (!evalCall) {
        return addTodoComment(issue, line);
      }

      const args = evalCall.getArguments();

      // Check for simple eval(variable) pattern
      if (args.length === 1 && Node.isIdentifier(args[0])) {
        const varName = args[0].getText();

        // Only convert if variable name suggests JSON
        if (/json|data|response|config|settings/i.test(varName)) {
          const lineStartOffset = getLineStartOffset(content, issue.line);
          const callStart = evalCall.getStart() - lineStartOffset;
          const callEnd = evalCall.getEnd() - lineStartOffset;

          const newLine = `${line.slice(0, callStart)}JSON.parse(${varName})${line.slice(callEnd)}`;

          return {
            action: 'replace-line',
            file: issue.file,
            line: issue.line,
            oldCode: line,
            newCode: newLine,
          };
        }
      }

      // Default: add TODO comment
      return addTodoComment(issue, line);
    } finally {
      cleanup();
    }
  } catch {
    return addTodoComment(issue, line);
  }
}

/**
 * Get the byte offset where a line starts
 */
function getLineStartOffset(content: string, lineNumber: number): number {
  const lines = content.split('\n');
  let offset = 0;
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
    offset += (lines[i]?.length ?? 0) + 1; // +1 for newline
  }
  return offset;
}

/**
 * Add a TODO comment above the problematic line
 */
function addTodoComment(issue: QualityIssue, line: string): FixOperation {
  // Preserve indentation
  const indent = line.match(/^(\s*)/)?.[1] ?? '';

  return {
    action: 'insert-before',
    file: issue.file,
    line: issue.line,
    newCode: `${indent}// TODO: Security risk - refactor to avoid eval()`,
  };
}
