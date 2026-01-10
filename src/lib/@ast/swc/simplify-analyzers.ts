/**
 * @module lib/@ast/swc/simplify-analyzers
 * @description AST-based code simplification analyzers using SWC
 *
 * These analyzers use proper AST traversal instead of regex for accurate detection.
 * Zero false positives > high recall (Google principle).
 *
 * Used by: commands/fix/recommendations/rules/simplify.ts
 */

import type {
  BinaryExpression,
  BlockStatement,
  BooleanLiteral,
  ConditionalExpression,
  Expression,
  IfStatement,
  Node,
  ReturnStatement,
  Statement,
  SwitchCase,
  SwitchStatement,
} from '@swc/core';
import { parseFile } from './parser';
import { findNodesByType, getNodeType, visitNode } from './visitor';

/**
 * Location info with snippet for a detected issue
 */
export interface SimplifyLocation {
  line: number;
  snippet: string;
  /** Suggested fix */
  fix?: {
    before: string;
    after: string;
  };
}

/**
 * Result of simplify analysis
 */
export interface SimplifyAnalysisResult {
  /** Whether the pattern was detected */
  detected: boolean;
  /** Number of occurrences found */
  count: number;
  /** Locations where pattern was found (line numbers) */
  locations: number[];
  /** First location with snippet and fix suggestion */
  firstLocation?: SimplifyLocation;
}

/**
 * Parse content and handle errors gracefully
 */
function safeParse(content: string, filePath = 'temp.ts'): Node | null {
  try {
    const { ast } = parseFile(filePath, content);
    return ast;
  } catch {
    return null;
  }
}

/**
 * Check if expression is a string equality check (=== 'literal')
 */
function isStringEqualityCheck(node: BinaryExpression): boolean {
  if (node.operator !== '===' && node.operator !== '==') return false;

  const isLeftString = node.left.type === 'StringLiteral';
  const isRightString = node.right.type === 'StringLiteral';

  return isLeftString || isRightString;
}

/**
 * Check if statement is a return with string literal
 */
function isStringReturn(stmt: Statement): boolean {
  if (stmt.type !== 'ReturnStatement') return false;
  const ret = stmt as ReturnStatement;
  return ret.argument?.type === 'StringLiteral';
}

/**
 * Get the consequent statement from if/else (handles blocks)
 */
function getFirstStatement(stmt: Statement): Statement | null {
  if (stmt.type === 'BlockStatement') {
    const block = stmt as BlockStatement;
    return block.stmts[0] ?? null;
  }
  return stmt;
}

/**
 * Count if-else chain depth with string equality checks
 */
function countIfElseChainWithStringEquality(ifStmt: IfStatement): {
  branchCount: number;
  stringReturns: number;
} {
  let branchCount = 0;
  let stringReturns = 0;
  let current: Statement | null | undefined = ifStmt;

  while (current?.type === 'IfStatement') {
    const ifNode = current as IfStatement;

    // Check test is string equality
    if (ifNode.test.type === 'BinaryExpression') {
      const binExpr = ifNode.test as BinaryExpression;
      if (isStringEqualityCheck(binExpr)) {
        branchCount++;

        // Check consequent has string return
        const firstStmt = getFirstStatement(ifNode.consequent);
        if (firstStmt && isStringReturn(firstStmt)) {
          stringReturns++;
        }
      }
    }

    current = ifNode.alternate ?? null;
  }

  // Check final else branch
  if (current) {
    const firstStmt = getFirstStatement(current);
    if (firstStmt && isStringReturn(firstStmt)) {
      stringReturns++;
    }
  }

  return { branchCount, stringReturns };
}

/**
 * Detect verbose if-else chains that could be lookup tables.
 *
 * Looks for patterns like:
 * ```typescript
 * if (status === 'A') return 'Alpha';
 * else if (status === 'B') return 'Beta';
 * else if (status === 'C') return 'Gamma';
 * else return 'Unknown';
 * ```
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeVerboseConditionals(
  content: string,
  filePath = 'temp.ts',
): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const ifStatements = findNodesByType(ast, 'IfStatement') as IfStatement[];
  const locations: number[] = [];
  let count = 0;

  for (const ifStmt of ifStatements) {
    const { branchCount, stringReturns } = countIfElseChainWithStringEquality(ifStmt);

    // Need 3+ branches with string equality AND 3+ string returns
    if (branchCount >= 3 && stringReturns >= 3) {
      count++;
      const span = (ifStmt as { span?: { start: number } }).span;
      if (span) {
        // Approximate line number from span
        const linesBefore = content.slice(0, span.start).split('\n').length;
        locations.push(linesBefore);
      }
    }
  }

  return { detected: count > 0, count, locations };
}

/**
 * Detect redundant boolean expressions.
 *
 * Looks for patterns like:
 * - `x === true` / `x === false`
 * - `x ? true : false` / `x ? false : true`
 * - `Boolean(x)` on boolean context
 * - `!!x` in if condition
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeRedundantBoolean(
  content: string,
  filePath = 'temp.ts',
): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const locations: number[] = [];
  let count = 0;

  visitNode(ast, (node) => {
    const nodeType = getNodeType(node);

    // Check BinaryExpression: x === true, x === false
    if (nodeType === 'BinaryExpression') {
      const binExpr = node as BinaryExpression;
      if (binExpr.operator === '===' || binExpr.operator === '==') {
        const leftIsBool =
          binExpr.left.type === 'BooleanLiteral' ||
          (binExpr.left.type === 'Identifier' &&
            ((binExpr.left as { value: string }).value === 'true' ||
              (binExpr.left as { value: string }).value === 'false'));
        const rightIsBool =
          binExpr.right.type === 'BooleanLiteral' ||
          (binExpr.right.type === 'Identifier' &&
            ((binExpr.right as { value: string }).value === 'true' ||
              (binExpr.right as { value: string }).value === 'false'));

        if (leftIsBool || rightIsBool) {
          count++;
        }
      }
    }

    // Check ConditionalExpression: x ? true : false
    if (nodeType === 'ConditionalExpression') {
      const condExpr = node as ConditionalExpression;

      const consequentIsBoolLiteral = condExpr.consequent.type === 'BooleanLiteral';
      const alternateIsBoolLiteral = condExpr.alternate.type === 'BooleanLiteral';

      if (consequentIsBoolLiteral && alternateIsBoolLiteral) {
        const consVal = (condExpr.consequent as BooleanLiteral).value;
        const altVal = (condExpr.alternate as BooleanLiteral).value;

        // x ? true : false OR x ? false : true
        if ((consVal === true && altVal === false) || (consVal === false && altVal === true)) {
          count++;
        }
      }
    }
  });

  // Find first example for snippet
  let firstLocation: SimplifyLocation | undefined;
  if (count > 0) {
    // Find === true or === false pattern
    const boolPattern = /(\w+)\s*===?\s*(true|false)/;
    const ternaryPattern = /\?\s*true\s*:\s*false|\?\s*false\s*:\s*true/;

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const boolMatch = boolPattern.exec(line);
      if (boolMatch) {
        const varName = boolMatch[1];
        const boolVal = boolMatch[2];
        firstLocation = {
          line: i + 1,
          snippet: line.trim().slice(0, 60),
          fix: {
            before: `${varName} === ${boolVal}`,
            after: boolVal === 'true' ? varName! : `!${varName}`,
          },
        };
        break;
      }
      if (ternaryPattern.test(line)) {
        firstLocation = {
          line: i + 1,
          snippet: line.trim().slice(0, 60),
          fix: {
            before: 'x ? true : false',
            after: 'x (or Boolean(x))',
          },
        };
        break;
      }
    }
  }

  return {
    detected: count > 0,
    count,
    locations,
    ...(firstLocation && { firstLocation }),
  };
}

/**
 * Detect unnecessary else after return/throw/break/continue.
 *
 * Looks for patterns like:
 * ```typescript
 * if (error) {
 *   return null;
 * } else {
 *   return data;
 * }
 * ```
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeUnnecessaryElse(
  content: string,
  filePath = 'temp.ts',
): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const ifStatements = findNodesByType(ast, 'IfStatement') as IfStatement[];
  const locations: number[] = [];
  let count = 0;

  for (const ifStmt of ifStatements) {
    // Must have an else branch
    if (!ifStmt.alternate) continue;

    // Check if consequent ends with control flow statement
    const consequent = ifStmt.consequent;
    let lastStmt: Statement | null = null;

    if (consequent.type === 'BlockStatement') {
      const block = consequent as BlockStatement;
      lastStmt = block.stmts[block.stmts.length - 1] ?? null;
    } else {
      lastStmt = consequent;
    }

    if (!lastStmt) continue;

    const endsWithControlFlow =
      lastStmt.type === 'ReturnStatement' ||
      lastStmt.type === 'ThrowStatement' ||
      lastStmt.type === 'BreakStatement' ||
      lastStmt.type === 'ContinueStatement';

    if (endsWithControlFlow) {
      count++;
      const span = (ifStmt as { span?: { start: number } }).span;
      if (span) {
        const linesBefore = content.slice(0, span.start).split('\n').length;
        locations.push(linesBefore);
      }
    }
  }

  return { detected: count > 0, count, locations };
}

/**
 * Detect switch statements that could be lookup tables.
 *
 * Looks for switch statements where all cases only return values:
 * ```typescript
 * switch (type) {
 *   case 'A': return 1;
 *   case 'B': return 2;
 *   default: return 0;
 * }
 * ```
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeSwitchToLookup(
  content: string,
  filePath = 'temp.ts',
): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const switchStatements = findNodesByType(ast, 'SwitchStatement') as SwitchStatement[];
  const locations: number[] = [];
  let count = 0;

  for (const switchStmt of switchStatements) {
    const cases = switchStmt.cases;

    // Need at least 4 cases to suggest lookup table
    if (cases.length < 4) continue;

    // Check if all cases only return values
    let allCasesReturnOnly = true;

    for (const caseNode of cases) {
      const stmts = (caseNode as SwitchCase).consequent;

      // Allow empty cases (fall-through)
      if (stmts.length === 0) continue;

      // Check each statement in case
      let hasReturn = false;
      for (const stmt of stmts) {
        if (stmt.type === 'ReturnStatement') {
          hasReturn = true;
        } else if (stmt.type !== 'BreakStatement') {
          // Non-return, non-break statement found
          allCasesReturnOnly = false;
          break;
        }
      }

      if (!allCasesReturnOnly) break;

      // Must have a return (unless fall-through)
      if (!hasReturn && stmts.length > 0 && stmts[0]?.type !== 'BreakStatement') {
        allCasesReturnOnly = false;
        break;
      }
    }

    if (allCasesReturnOnly) {
      count++;
      const span = (switchStmt as { span?: { start: number } }).span;
      if (span) {
        const linesBefore = content.slice(0, span.start).split('\n').length;
        locations.push(linesBefore);
      }
    }
  }

  return { detected: count > 0, count, locations };
}

/**
 * Detect complex/nested ternary expressions.
 *
 * Looks for patterns like:
 * ```typescript
 * const value = a ? (b ? x : y) : (c ? z : w);
 * ```
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeComplexTernary(
  content: string,
  filePath = 'temp.ts',
): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const locations: number[] = [];
  let count = 0;

  visitNode(ast, (node) => {
    if (getNodeType(node) !== 'ConditionalExpression') return;

    const condExpr = node as ConditionalExpression;

    // Check for nested ternary in consequent or alternate
    const hasNestedTernary =
      condExpr.consequent.type === 'ConditionalExpression' ||
      condExpr.alternate.type === 'ConditionalExpression';

    if (hasNestedTernary) {
      count++;
      const span = (node as { span?: { start: number } }).span;
      if (span) {
        const linesBefore = content.slice(0, span.start).split('\n').length;
        locations.push(linesBefore);
      }
    }
  });

  return { detected: count > 0, count, locations };
}

/**
 * Detect callback hell (deeply nested callbacks).
 *
 * Looks for 3+ levels of nested arrow functions or function expressions.
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeCallbackHell(content: string, filePath = 'temp.ts'): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const locations: number[] = [];
  let count = 0;

  // Track depth during traversal
  let maxDepthFound = 0;
  let currentDepth = 0;

  visitNode(ast, (node) => {
    const nodeType = getNodeType(node);

    // Count function depth
    if (nodeType === 'ArrowFunctionExpression' || nodeType === 'FunctionExpression') {
      currentDepth++;
      if (currentDepth >= 3 && currentDepth > maxDepthFound) {
        maxDepthFound = currentDepth;
        count++;
        const span = (node as { span?: { start: number } }).span;
        if (span) {
          const linesBefore = content.slice(0, span.start).split('\n').length;
          if (!locations.includes(linesBefore)) {
            locations.push(linesBefore);
          }
        }
      }
    }
  });

  // Need to track depth properly - this is simplified version
  // For accurate tracking, we'd need post-visit callbacks

  return { detected: count > 0, count, locations };
}

/**
 * Detect array method chains that could be simplified.
 *
 * Looks for patterns like:
 * ```typescript
 * arr.filter(x => x > 0).map(x => x * 2).filter(x => x < 100);
 * ```
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeInefficientArrayChain(
  content: string,
  filePath = 'temp.ts',
): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const locations: number[] = [];
  let count = 0;

  const arrayMethods = new Set(['filter', 'map', 'forEach', 'reduce', 'find', 'some', 'every']);

  visitNode(ast, (node) => {
    if (getNodeType(node) !== 'CallExpression') return;

    // Walk up the member expression chain
    let chainLength = 0;
    let current: Expression = node as Expression;

    while (current.type === 'CallExpression') {
      const callee = (current as { callee: Expression }).callee;

      if (callee.type === 'MemberExpression') {
        const prop = (callee as { property: { value?: string; type: string } }).property;
        const propName = prop.type === 'Identifier' ? (prop as { value: string }).value : undefined;

        if (propName && arrayMethods.has(propName)) {
          chainLength++;
        }

        current = (callee as { object: Expression }).object;
      } else {
        break;
      }
    }

    if (chainLength >= 3) {
      count++;
      const span = (node as { span?: { start: number } }).span;
      if (span) {
        const linesBefore = content.slice(0, span.start).split('\n').length;
        if (!locations.includes(linesBefore)) {
          locations.push(linesBefore);
        }
      }
    }
  });

  return { detected: count > 0, count, locations };
}

/**
 * Detect string concatenation that could use template literals.
 *
 * Looks for patterns like:
 * ```typescript
 * 'Hello, ' + name + '!'
 * ```
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeStringConcatenation(
  content: string,
  filePath = 'temp.ts',
): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const locations: number[] = [];
  let count = 0;

  visitNode(ast, (node) => {
    if (getNodeType(node) !== 'BinaryExpression') return;

    const binExpr = node as BinaryExpression;
    if (binExpr.operator !== '+') return;

    // Count string literals and non-literals in the chain
    let hasStringLiteral = false;
    let hasNonLiteral = false;
    let concatCount = 0;

    const checkConcatChain = (expr: Expression): void => {
      if (expr.type === 'BinaryExpression') {
        const bin = expr as BinaryExpression;
        if (bin.operator === '+') {
          concatCount++;
          checkConcatChain(bin.left);
          checkConcatChain(bin.right);
        }
      } else if (expr.type === 'StringLiteral') {
        hasStringLiteral = true;
      } else if (expr.type === 'Identifier' || expr.type === 'CallExpression') {
        hasNonLiteral = true;
      }
    };

    checkConcatChain(binExpr);

    // Flag if there's string + variable + string pattern (2+ concatenations)
    if (hasStringLiteral && hasNonLiteral && concatCount >= 2) {
      count++;
      const span = (node as { span?: { start: number } }).span;
      if (span) {
        const linesBefore = content.slice(0, span.start).split('\n').length;
        if (!locations.includes(linesBefore)) {
          locations.push(linesBefore);
        }
      }
    }
  });

  return { detected: count > 0, count, locations };
}

/**
 * Detect object shorthand opportunities.
 *
 * Looks for patterns like:
 * ```typescript
 * { name: name, age: age }
 * ```
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeObjectShorthand(
  content: string,
  filePath = 'temp.ts',
): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const locations: number[] = [];
  let count = 0;

  visitNode(ast, (node) => {
    if (getNodeType(node) !== 'ObjectExpression') return;

    const objExpr = node as unknown as {
      properties: Array<{ type: string; key?: Node; value?: Node }>;
    };
    let redundantCount = 0;

    for (const prop of objExpr.properties) {
      if (prop.type !== 'KeyValueProperty') continue;

      const key = prop.key as { type: string; value?: string };
      const value = prop.value as { type: string; value?: string };

      // Check if key and value are the same identifier
      if (key?.type === 'Identifier' && value?.type === 'Identifier') {
        if (key.value === value.value) {
          redundantCount++;
        }
      }
    }

    // Flag if 2+ redundant pairs
    if (redundantCount >= 2) {
      count++;
      const span = (node as { span?: { start: number } }).span;
      if (span) {
        const linesBefore = content.slice(0, span.start).split('\n').length;
        if (!locations.includes(linesBefore)) {
          locations.push(linesBefore);
        }
      }
    }
  });

  return { detected: count > 0, count, locations };
}

/**
 * Detect multiple empty functions (noop candidates).
 *
 * Looks for 3+ empty arrow functions: `() => {}`
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeEmptyFunctions(
  content: string,
  filePath = 'temp.ts',
): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const locations: number[] = [];
  let count = 0;

  visitNode(ast, (node) => {
    const nodeType = getNodeType(node);
    if (nodeType !== 'ArrowFunctionExpression' && nodeType !== 'FunctionExpression') return;

    const fn = node as unknown as { body: Node };

    // Check if body is empty block
    if (fn.body?.type === 'BlockStatement') {
      const block = fn.body as BlockStatement;
      if (block.stmts.length === 0) {
        count++;
        const span = (node as { span?: { start: number } }).span;
        if (span) {
          const linesBefore = content.slice(0, span.start).split('\n').length;
          locations.push(linesBefore);
        }
      }
    }
  });

  // Only flag if 3+ empty functions
  return {
    detected: count >= 3,
    count: count >= 3 ? count : 0,
    locations: count >= 3 ? locations : [],
  };
}

/**
 * Detect double/triple negations.
 *
 * Looks for patterns like: `!!value`, `!!!value`
 *
 * @param content - Source code content
 * @param filePath - File path for parsing context
 * @returns Analysis result
 */
export function analyzeNegationChain(
  content: string,
  filePath = 'temp.ts',
): SimplifyAnalysisResult {
  const ast = safeParse(content, filePath);
  if (!ast) return { detected: false, count: 0, locations: [] };

  const locations: number[] = [];
  let count = 0;

  visitNode(ast, (node) => {
    if (getNodeType(node) !== 'UnaryExpression') return;

    const unary = node as unknown as { operator: string; argument: Node };
    if (unary.operator !== '!') return;

    // Check if argument is also negation
    if (unary.argument.type === 'UnaryExpression') {
      const innerUnary = unary.argument as unknown as { operator: string };
      if (innerUnary.operator === '!') {
        count++;
        const span = (node as { span?: { start: number } }).span;
        if (span) {
          const linesBefore = content.slice(0, span.start).split('\n').length;
          if (!locations.includes(linesBefore)) {
            locations.push(linesBefore);
          }
        }
      }
    }
  });

  return { detected: count > 0, count, locations };
}
