/**
 * @module commands/audit/enrichment/complexity-breakdown
 * @description Analyze complexity issues to show which branches contribute
 *
 * Uses SWC parser to extract detailed complexity breakdown for functions,
 * showing each branch (if, for, while, etc.) that contributes to the
 * cyclomatic complexity score.
 *
 * @example
 * ```typescript
 * import { analyzeComplexityBreakdown } from './complexity-breakdown';
 *
 * const breakdown = analyzeComplexityBreakdown('/path/to/file.ts', 42);
 * // Returns breakdown with all branches contributing to complexity
 * ```
 */

import type { Node, Span } from '@swc/core';
import { offsetToLine, parseFile, visitNode } from '../../../lib/@ast/swc';
import { fileCache } from '../../../lib/@cache';
import { extractRangeFromContent } from './code-snippets';
import type { BranchType, ComplexityBranch, ComplexityBreakdown } from './snippet-types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Node types that increase cyclomatic complexity */
const COMPLEXITY_NODE_MAP: Record<string, BranchType> = {
  IfStatement: 'if',
  ForStatement: 'for',
  ForInStatement: 'for-in',
  ForOfStatement: 'for-of',
  WhileStatement: 'while',
  DoWhileStatement: 'do-while',
  SwitchStatement: 'switch',
  SwitchCase: 'case',
  CatchClause: 'catch',
  ConditionalExpression: 'ternary',
};

/** Binary operators that add to complexity */
const COMPLEXITY_OPERATORS: Record<string, BranchType> = {
  '&&': 'logical-and',
  '||': 'logical-or',
  '??': 'nullish-coalesce',
};

// ============================================================================
// TYPES
// ============================================================================

interface FunctionSpan {
  name: string;
  start: number;
  end: number;
  startLine: number;
  endLine: number;
}

interface BaseNode {
  type: string;
  span?: Span;
}

interface BinaryExpressionNode extends BaseNode {
  type: 'BinaryExpression';
  operator: string;
}

interface FunctionDeclarationNode extends BaseNode {
  type: 'FunctionDeclaration';
  identifier?: { value: string };
  body?: { span?: Span };
}

interface FunctionExpressionNode extends BaseNode {
  type: 'FunctionExpression';
  identifier?: { value: string };
  body?: { span?: Span };
}

interface ClassMethodNode extends BaseNode {
  type: 'ClassMethod';
  key: BaseNode & { value?: string };
  function: {
    body?: { span?: Span };
  };
}

interface VariableDeclaratorNode extends BaseNode {
  type: 'VariableDeclarator';
  id: BaseNode & { value?: string };
  init?: BaseNode;
}

// ============================================================================
// MAIN ANALYZER
// ============================================================================

/**
 * Analyze complexity breakdown for a function at a specific line
 *
 * @param filePath - Path to the file
 * @param targetLine - Line number where the complexity issue was reported
 * @returns ComplexityBreakdown or null if not found
 */
export function analyzeComplexityBreakdown(
  filePath: string,
  targetLine: number,
): ComplexityBreakdown | null {
  try {
    const content = fileCache.get(filePath);
    return analyzeComplexityFromContent(filePath, content, targetLine);
  } catch {
    return null;
  }
}

/**
 * Analyze complexity from content string
 */
export function analyzeComplexityFromContent(
  filePath: string,
  content: string,
  targetLine: number,
): ComplexityBreakdown | null {
  const { ast, lineOffsets, baseOffset } = parseFile(filePath, content);

  // First pass: find the function containing the target line
  const functionSpan = findFunctionAtLine(ast, targetLine, lineOffsets, baseOffset);
  if (!functionSpan) {
    return null;
  }

  // Second pass: collect all branches within the function
  const branches = collectBranches(ast, functionSpan, lineOffsets, baseOffset);

  // Calculate total complexity (base 1 + branches)
  const complexity = 1 + branches.length;

  // Extract function snippet
  const snippet = extractRangeFromContent(content, functionSpan.startLine, functionSpan.endLine);

  return {
    functionName: functionSpan.name,
    complexity,
    startLine: functionSpan.startLine,
    endLine: functionSpan.endLine,
    branches,
    ...(snippet && { snippet }),
  };
}

// ============================================================================
// FUNCTION FINDER
// ============================================================================

/**
 * Find the function containing the target line
 */
function findFunctionAtLine(
  ast: Node,
  targetLine: number,
  lineOffsets: number[],
  baseOffset: number,
): FunctionSpan | null {
  let result: FunctionSpan | null = null;
  let currentVariableName: string | null = null;

  visitNode(ast, (node) => {
    const baseNode = node as BaseNode;
    const nodeType = baseNode.type;
    const span = baseNode.span;

    // Track variable names for arrow functions
    if (nodeType === 'VariableDeclarator') {
      const varDecl = node as VariableDeclaratorNode;
      if (varDecl.id.value) {
        currentVariableName = varDecl.id.value;
      }
    }

    // Check function nodes
    if (!span) return;

    const functionInfo = extractFunctionInfo(
      node,
      nodeType,
      span,
      baseOffset,
      lineOffsets,
      currentVariableName,
    );
    if (!functionInfo) return;

    // Check if target line is within this function
    if (targetLine >= functionInfo.startLine && targetLine <= functionInfo.endLine) {
      // Keep the innermost function (narrowest range)
      if (
        !result ||
        functionInfo.endLine - functionInfo.startLine < result.endLine - result.startLine
      ) {
        result = functionInfo;
      }
    }
  });

  return result;
}

/**
 * Extract function info from a node
 */
function extractFunctionInfo(
  node: Node,
  nodeType: string,
  span: Span,
  baseOffset: number,
  lineOffsets: number[],
  variableName: string | null,
): FunctionSpan | null {
  const adjustedStart = span.start - baseOffset;
  const adjustedEnd = span.end - baseOffset;
  const startLine = offsetToLine(adjustedStart, lineOffsets);
  const endLine = offsetToLine(adjustedEnd, lineOffsets);

  switch (nodeType) {
    case 'FunctionDeclaration': {
      const funcDecl = node as FunctionDeclarationNode;
      return {
        name: funcDecl.identifier?.value ?? 'anonymous',
        start: adjustedStart,
        end: adjustedEnd,
        startLine,
        endLine,
      };
    }

    case 'ArrowFunctionExpression': {
      return {
        name: variableName ?? 'arrow',
        start: adjustedStart,
        end: adjustedEnd,
        startLine,
        endLine,
      };
    }

    case 'FunctionExpression': {
      const funcExpr = node as FunctionExpressionNode;
      return {
        name: funcExpr.identifier?.value ?? variableName ?? 'anonymous',
        start: adjustedStart,
        end: adjustedEnd,
        startLine,
        endLine,
      };
    }

    case 'ClassMethod': {
      const classMethod = node as ClassMethodNode;
      return {
        name: classMethod.key.value ?? 'method',
        start: adjustedStart,
        end: adjustedEnd,
        startLine,
        endLine,
      };
    }

    default:
      return null;
  }
}

// ============================================================================
// BRANCH COLLECTOR
// ============================================================================

/**
 * Collect all branches within a function
 */
function collectBranches(
  ast: Node,
  functionSpan: FunctionSpan,
  lineOffsets: number[],
  baseOffset: number,
): ComplexityBranch[] {
  const branches: ComplexityBranch[] = [];
  let currentDepth = 0;
  const depthStack: string[] = [];

  visitNode(ast, (node) => {
    const baseNode = node as BaseNode;
    const nodeType = baseNode.type;
    const span = baseNode.span;

    if (!span) return;

    const adjustedStart = span.start - baseOffset;
    const line = offsetToLine(adjustedStart, lineOffsets);

    // Check if within function bounds
    if (adjustedStart < functionSpan.start || adjustedStart > functionSpan.end) {
      return;
    }

    // Track nesting depth
    if (isNestingNode(nodeType)) {
      depthStack.push(nodeType);
      currentDepth = depthStack.length;
    }

    // Check for complexity nodes
    const branchType = COMPLEXITY_NODE_MAP[nodeType];
    if (branchType) {
      branches.push({
        line,
        type: branchType,
        reason: getReasonForBranch(branchType, nodeType),
        depth: currentDepth,
      });
    }

    // Check for binary operators
    if (nodeType === 'BinaryExpression') {
      const binExpr = node as BinaryExpressionNode;
      const opType = COMPLEXITY_OPERATORS[binExpr.operator];
      if (opType) {
        branches.push({
          line,
          type: opType,
          reason: getReasonForOperator(opType),
          depth: currentDepth,
        });
      }
    }
  });

  // Sort branches by line number
  return branches.sort((a, b) => a.line - b.line);
}

/**
 * Check if a node type increases nesting depth
 */
function isNestingNode(nodeType: string): boolean {
  return [
    'IfStatement',
    'ForStatement',
    'ForInStatement',
    'ForOfStatement',
    'WhileStatement',
    'DoWhileStatement',
    'SwitchStatement',
    'TryStatement',
  ].includes(nodeType);
}

/**
 * Get human-readable reason for a branch type
 */
function getReasonForBranch(type: BranchType, nodeType: string): string {
  const reasons: Record<BranchType, string> = {
    if: 'conditional branch',
    'else-if': 'else-if branch',
    else: 'else branch',
    for: 'for loop',
    'for-in': 'for-in loop',
    'for-of': 'for-of loop',
    while: 'while loop',
    'do-while': 'do-while loop',
    switch: 'switch statement',
    case: 'switch case',
    catch: 'error handler',
    ternary: 'ternary expression',
    'logical-and': 'short-circuit AND',
    'logical-or': 'short-circuit OR',
    'nullish-coalesce': 'nullish coalescing',
  };

  return reasons[type] ?? nodeType;
}

/**
 * Get human-readable reason for a binary operator
 */
function getReasonForOperator(type: BranchType): string {
  return getReasonForBranch(type, type);
}

// ============================================================================
// XML FORMATTING
// ============================================================================

/**
 * Format complexity breakdown as XML
 *
 * @param breakdown - ComplexityBreakdown to format
 * @param indent - Number of spaces for indentation
 * @returns Formatted XML string
 */
export function formatBreakdownAsXml(breakdown: ComplexityBreakdown, indent: number = 0): string {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];

  lines.push(
    `${pad}<complexity-breakdown function="${breakdown.functionName}" complexity="${breakdown.complexity}">`,
  );

  for (const branch of breakdown.branches) {
    const depthAttr = branch.depth > 0 ? ` depth="${branch.depth}"` : '';
    lines.push(
      `${pad}  <branch line="${branch.line}" type="${branch.type}"${depthAttr} reason="${branch.reason}"/>`,
    );
  }

  lines.push(`${pad}</complexity-breakdown>`);

  return lines.join('\n');
}
