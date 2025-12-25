/**
 * @module commands/fix/ast-utils/nesting
 * @description Reduce code nesting by converting to early returns/continues
 *
 * Patterns handled:
 * 1. if-only blocks → invert condition + early return
 * 2. if-else with simple else → invert + early return
 * 3. Loop guards → invert + early continue
 * 4. Nested ifs → combine with &&
 */

import { type Block, type IfStatement, Node, SyntaxKind } from 'ts-morph';
import { astPool } from '@/lib/@ast';
import type { ReduceNestingResult } from './types';

const MIN_STATEMENTS_TO_TRANSFORM = 3;

// ============================================================================
// CONDITION INVERSION
// ============================================================================

const OPERATOR_INVERSIONS: Record<string, string> = {
  '===': '!==',
  '!==': '===',
  '==': '!=',
  '!=': '==',
  '>=': '<',
  '<=': '>',
  '>': '<=',
  '<': '>=',
};

/**
 * Invert a condition for early return pattern
 */
function invertCondition(condition: string): string {
  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(`const x = ${condition};`, 'temp.ts');

    try {
      const varDecl = sourceFile.getVariableDeclarations()[0];
      const init = varDecl?.getInitializer();

      if (!init) {
        return `!(${condition})`;
      }

      // Handle prefix ! operator
      if (Node.isPrefixUnaryExpression(init)) {
        const operator = init.getOperatorToken();
        if (operator === SyntaxKind.ExclamationToken) {
          return init.getOperand().getText();
        }
      }

      // Handle binary comparison operators
      if (Node.isBinaryExpression(init)) {
        const operator = init.getOperatorToken().getText();
        const left = init.getLeft().getText();
        const right = init.getRight().getText();

        if (OPERATOR_INVERSIONS[operator]) {
          // For && and ||, use simple negation (De Morgan's law is complex)
          if (operator === '&&' || operator === '||') {
            return `!(${condition})`;
          }
          return `${left} ${OPERATOR_INVERSIONS[operator]} ${right}`;
        }
      }

      return `!(${condition})`;
    } finally {
      cleanup();
    }
  } catch {
    // Fallback to simple string manipulation
    if (condition.startsWith('!') && !condition.startsWith('!=')) {
      return condition.slice(1);
    }

    for (const [op, inverted] of Object.entries(OPERATOR_INVERSIONS)) {
      if (condition.includes(op)) {
        return condition.replace(op, inverted);
      }
    }

    return `!(${condition})`;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get function body as Block node
 */
function getBody(func: Node): Block | undefined {
  if (
    Node.isFunctionDeclaration(func) ||
    Node.isMethodDeclaration(func) ||
    Node.isFunctionExpression(func)
  ) {
    return func.getBody() as Block | undefined;
  }
  if (Node.isArrowFunction(func)) {
    const body = func.getBody();
    return Node.isBlock(body) ? body : undefined;
  }
  return undefined;
}

/**
 * Get all function-like nodes from source file
 */
function getAllFunctions(sourceFile: Node): Node[] {
  return [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
  ];
}

// ============================================================================
// NESTING REDUCTION PATTERNS
// ============================================================================

/**
 * Combine nested if statements with &&
 *
 * Transform:
 *   if (a) { if (b) { code } }
 * To:
 *   if (a && b) { code }
 */
function combineNestedIfs(body: Block): number {
  let changes = 0;
  const statements = body.getStatements();

  for (const stmt of statements) {
    if (!Node.isIfStatement(stmt)) continue;

    const outerIf = stmt as IfStatement;
    const outerThen = outerIf.getThenStatement();
    const outerElse = outerIf.getElseStatement();

    if (outerElse) continue;
    if (!Node.isBlock(outerThen)) continue;

    const innerStatements = outerThen.getStatements();
    if (innerStatements.length !== 1) continue;

    const innerStmt = innerStatements[0];
    if (!innerStmt || !Node.isIfStatement(innerStmt)) continue;

    const innerIf = innerStmt as IfStatement;
    if (innerIf.getElseStatement()) continue;

    const outerCond = outerIf.getExpression().getText();
    const innerCond = innerIf.getExpression().getText();
    const innerBody = innerIf.getThenStatement().getText();

    const combinedCond = `(${outerCond}) && (${innerCond})`;
    outerIf.replaceWithText(`if (${combinedCond}) ${innerBody}`);
    changes++;
  }

  return changes;
}

/**
 * Reduce nesting in loops by converting guard ifs to early continue
 *
 * Transform:
 *   for (x of arr) { if (cond) { code } }
 * To:
 *   for (x of arr) { if (!cond) continue; code }
 */
function reduceLoopNesting(body: Block): number {
  let changes = 0;

  const loops = [
    ...body.getDescendantsOfKind(SyntaxKind.ForStatement),
    ...body.getDescendantsOfKind(SyntaxKind.ForOfStatement),
    ...body.getDescendantsOfKind(SyntaxKind.ForInStatement),
    ...body.getDescendantsOfKind(SyntaxKind.WhileStatement),
  ];

  for (const loop of loops) {
    const loopBody = loop.getStatement();
    if (!Node.isBlock(loopBody)) continue;

    const statements = loopBody.getStatements();
    if (statements.length !== 1) continue;

    const firstStmt = statements[0];
    if (!firstStmt || !Node.isIfStatement(firstStmt)) continue;

    const ifStmt = firstStmt as IfStatement;
    const thenBlock = ifStmt.getThenStatement();
    const elseBlock = ifStmt.getElseStatement();

    if (elseBlock || !Node.isBlock(thenBlock)) continue;

    const thenStatements = thenBlock.getStatements();
    if (thenStatements.length < 2) continue;

    const condition = ifStmt.getExpression().getText();
    const invertedCondition = invertCondition(condition);
    const innerCode = thenStatements.map((s) => s.getText()).join('\n');

    ifStmt.replaceWithText(`if (${invertedCondition}) continue;\n\n${innerCode}`);
    changes++;
  }

  return changes;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Reduce nesting by converting if-else to early returns
 *
 * @param content - Source code content
 * @param filePath - File path (for AST parsing)
 * @param targetLine - Optional: only transform if at this line
 */
export function reduceNesting(
  content: string,
  filePath: string,
  targetLine?: number,
): ReduceNestingResult {
  try {
    const [sourceFile, cleanup] = astPool.createSourceFile(content, filePath);

    try {
      let changesCount = 0;
      const functions = getAllFunctions(sourceFile);

      for (const func of functions) {
        const body = getBody(func);
        if (!body) continue;

        // Skip if targeting specific line and function isn't there
        if (targetLine !== undefined) {
          const startLine = func.getStartLineNumber();
          const endLine = func.getEndLineNumber();
          if (targetLine < startLine || targetLine > endLine) continue;
        }

        const statements = body.getStatements();

        // Process if statements from end to start (reverse iteration)
        for (let i = statements.length - 1; i >= 0; i--) {
          const stmt = statements[i];
          if (!stmt || !Node.isIfStatement(stmt)) continue;

          const ifStmt = stmt as IfStatement;
          const thenBlock = ifStmt.getThenStatement();
          const elseBlock = ifStmt.getElseStatement();

          // Pattern 1: if with no else, wrapping significant code
          if (!elseBlock && Node.isBlock(thenBlock)) {
            const thenStatements = thenBlock.getStatements();

            if (thenStatements.length >= MIN_STATEMENTS_TO_TRANSFORM) {
              const condition = ifStmt.getExpression().getText();
              const invertedCondition = invertCondition(condition);
              const innerCode = thenStatements.map((s) => s.getText()).join('\n');

              ifStmt.replaceWithText(`if (${invertedCondition}) return;\n\n${innerCode}`);
              changesCount++;
            }
          }

          // Pattern 2: if-else where else is just return
          if (elseBlock && Node.isBlock(elseBlock)) {
            const elseStatements = elseBlock.getStatements();
            if (elseStatements.length === 1 && elseStatements[0]?.getText().startsWith('return')) {
              const condition = ifStmt.getExpression().getText();
              const invertedCondition = invertCondition(condition);
              const returnStmt = elseStatements[0].getText();

              const thenCode = Node.isBlock(thenBlock)
                ? thenBlock
                    .getStatements()
                    .map((s) => s.getText())
                    .join('\n')
                : thenBlock.getText();

              ifStmt.replaceWithText(`if (${invertedCondition}) ${returnStmt}\n\n${thenCode}`);
              changesCount++;
            }
          }
        }

        // Apply additional patterns
        changesCount += reduceLoopNesting(body);
        changesCount += combineNestedIfs(body);
      }

      if (changesCount === 0) {
        return { success: false, error: 'No patterns found to reduce nesting' };
      }

      return {
        success: true,
        newContent: sourceFile.getFullText(),
        changesCount,
      };
    } finally {
      cleanup();
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
