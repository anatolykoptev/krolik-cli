/**
 * @module commands/fix/refactorings/parsers
 * @description Parsing helpers for refactoring detection
 */

import { type IfStatement, Node, type ReturnStatement } from 'ts-morph';

// ============================================================================
// TYPES
// ============================================================================

export type CheckType = 'includes' | 'startsWith' | 'endsWith' | 'equals' | 'other';

export interface ConditionInfo {
  check: string;
  result: string;
  checkType: CheckType;
  searchValue: string;
}

export interface ParsedIfResult {
  condition: ConditionInfo | null;
  variableName: string | null;
  endLine: number;
}

// ============================================================================
// METHOD TYPE DETECTION
// ============================================================================

/**
 * Get check type from method name
 */
export function getCheckType(methodName: string): CheckType {
  const methodMap: Record<string, CheckType> = {
    includes: 'includes',
    startsWith: 'startsWith',
    endsWith: 'endsWith',
    equals: 'equals',
    '===': 'equals',
  };
  return methodMap[methodName] ?? 'other';
}

// ============================================================================
// RETURN VALUE PARSING
// ============================================================================

/**
 * Extract return value from a then statement
 */
export function extractReturnValue(thenStatement: Node): string | null {
  // Direct return statement
  if (Node.isReturnStatement(thenStatement)) {
    return extractStringFromReturn(thenStatement);
  }

  // Block with single return
  if (Node.isBlock(thenStatement)) {
    const statements = thenStatement.getStatements();
    if (statements.length === 1 && Node.isReturnStatement(statements[0])) {
      return extractStringFromReturn(statements[0] as ReturnStatement);
    }
  }

  return null;
}

/**
 * Extract string literal from return statement
 */
function extractStringFromReturn(ret: ReturnStatement): string | null {
  const returnExpr = ret.getExpression();
  if (returnExpr && Node.isStringLiteral(returnExpr)) {
    return returnExpr.getLiteralValue();
  }
  return null;
}

// ============================================================================
// CONDITION PARSING
// ============================================================================

/**
 * Parse an if statement condition for refactoring
 */
export function parseIfCondition(condition: Node): {
  varName: string;
  methodName: string;
  searchValue: string;
  checkType: CheckType;
} | null {
  // Must be a call expression like str.includes('x')
  if (!Node.isCallExpression(condition)) return null;

  const callExpr = condition.getExpression();
  if (!Node.isPropertyAccessExpression(callExpr)) return null;

  const varExpr = callExpr.getExpression();
  const methodName = callExpr.getName();
  const varName = varExpr.getText();

  // Check method type
  const checkType = getCheckType(methodName);
  if (checkType === 'other') return null;

  // Get search value (first argument)
  const args = condition.getArguments();
  if (args.length === 0) return null;

  const firstArg = args[0];
  if (!firstArg || !Node.isStringLiteral(firstArg)) return null;

  const searchValue = firstArg.getLiteralValue();

  return { varName, methodName, searchValue, checkType };
}

/**
 * Parse a single if statement for if-chain detection
 */
export function parseIfStatement(ifStmt: IfStatement, currentVarName: string): ParsedIfResult {
  const condition = ifStmt.getExpression();
  const thenStatement = ifStmt.getThenStatement();

  // Parse condition
  const parsed = parseIfCondition(condition);
  if (!parsed) {
    return { condition: null, variableName: null, endLine: ifStmt.getEndLineNumber() };
  }

  // Check variable consistency
  if (currentVarName && parsed.varName !== currentVarName) {
    return { condition: null, variableName: null, endLine: ifStmt.getEndLineNumber() };
  }

  // Get return value
  const returnValue = extractReturnValue(thenStatement);
  if (!returnValue) {
    return { condition: null, variableName: parsed.varName, endLine: ifStmt.getEndLineNumber() };
  }

  const conditionInfo: ConditionInfo = {
    check: `${parsed.varName}.${parsed.methodName}('${parsed.searchValue}')`,
    result: `'${returnValue}'`,
    checkType: parsed.checkType,
    searchValue: parsed.searchValue,
  };

  return {
    condition: conditionInfo,
    variableName: parsed.varName,
    endLine: ifStmt.getEndLineNumber(),
  };
}

// ============================================================================
// DEFAULT RETURN DETECTION
// ============================================================================

/**
 * Find default return after if-chain
 */
export function findDefaultReturn(
  returnStatements: ReturnStatement[],
  endLine: number,
): { result: string; newEndLine: number } | null {
  for (const ret of returnStatements) {
    const retLine = ret.getStartLineNumber();
    if (retLine > endLine && retLine <= endLine + 2) {
      const retExpr = ret.getExpression();
      if (retExpr && Node.isStringLiteral(retExpr)) {
        return {
          result: `'${retExpr.getLiteralValue()}'`,
          newEndLine: retLine,
        };
      }
    }
  }
  return null;
}

// ============================================================================
// CONDITION INVERSION
// ============================================================================

/**
 * Invert a boolean condition for guard clause
 */
export function invertCondition(condition: string): string {
  // Handle negation
  if (condition.startsWith('!')) {
    return condition.slice(1);
  }

  // Handle common operators
  const inversions: [RegExp, string][] = [
    [/(.+)\s*===\s*(.+)/, '$1 !== $2'],
    [/(.+)\s*!==\s*(.+)/, '$1 === $2'],
    [/(.+)\s*>\s*(.+)/, '$1 <= $2'],
    [/(.+)\s*<\s*(.+)/, '$1 >= $2'],
    [/(.+)\s*>=\s*(.+)/, '$1 < $2'],
    [/(.+)\s*<=\s*(.+)/, '$1 > $2'],
  ];

  for (const [pattern, replacement] of inversions) {
    if (pattern.test(condition)) {
      return condition.replace(pattern, replacement);
    }
  }

  // Default: wrap in negation
  return `!(${condition})`;
}
