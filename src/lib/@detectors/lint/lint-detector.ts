/**
 * @module lib/@detectors/lint/lint-detector
 * @description SWC AST detector for lint issues
 *
 * Detects:
 * - console.* method calls (object-based detection)
 * - debugger statements
 * - alert/confirm/prompt calls (global window APIs)
 * - eval() calls
 * - empty catch blocks
 *
 * Uses centralized patterns from browser-apis
 */

import type { Node, Span } from '@swc/core';
import type { LintDetection } from '../patterns/ast/types';
import { isConsoleMember, isDialogFunction, isEvalFunction } from '../patterns/browser-apis';

// ============================================================================
// INTERNAL TYPES FOR NODE EXTRACTION
// ============================================================================

interface CatchClauseNode {
  body?: {
    type?: string;
    stmts?: unknown[];
  };
}

interface CallExpressionNode {
  callee?: Node;
  base?: Node;
  span?: Span;
}

interface MemberExpressionNode {
  object?: Node;
  property?: Node;
}

interface IdentifierNode {
  type?: string;
  value?: string;
}

// ============================================================================
// HELPER DETECTORS (each with complexity <= 10)
// ============================================================================

/**
 * Detect debugger statement
 */
function detectDebuggerStatement(nodeType: string, offset: number): LintDetection | null {
  if (nodeType === 'DebuggerStatement') {
    return { type: 'debugger', offset };
  }
  return null;
}

/**
 * Detect empty catch block
 * Empty = no statements or only a return statement
 */
function detectEmptyCatchBlock(node: Node, nodeType: string, offset: number): LintDetection | null {
  if (nodeType !== 'CatchClause') {
    return null;
  }

  const catchClause = node as CatchClauseNode;
  const body = catchClause.body;

  if (!body || body.type !== 'BlockStatement') {
    return null;
  }

  const stmts = body.stmts ?? [];

  // Empty catch block
  if (stmts.length === 0) {
    return { type: 'empty-catch', offset };
  }

  // Catch with only return statement (also considered empty handling)
  if (stmts.length === 1) {
    const stmt = stmts[0] as { type?: string };
    if (stmt.type === 'ReturnStatement') {
      return { type: 'empty-catch', offset };
    }
  }

  return null;
}

/**
 * Extract callee from call expression or optional chaining
 */
function extractCallee(node: Node, nodeType: string): Node | null {
  if (nodeType !== 'CallExpression' && nodeType !== 'OptionalChainingExpression') {
    return null;
  }

  const callExpr = node as CallExpressionNode;
  return callExpr.callee ?? callExpr.base ?? null;
}

/**
 * Detect console.* method calls from member expression
 */
function detectConsoleCall(callee: Node, offset: number): LintDetection | null {
  const calleeType = (callee as { type?: string }).type;

  if (calleeType !== 'MemberExpression') {
    return null;
  }

  const memberExpr = callee as MemberExpressionNode;
  const object = memberExpr.object;
  const property = memberExpr.property;

  if (!object || !property) {
    return null;
  }

  const objectNode = object as IdentifierNode;
  const propertyNode = property as IdentifierNode;

  if (objectNode.type !== 'Identifier' || propertyNode.type !== 'Identifier') {
    return null;
  }

  const objectValue = objectNode.value;
  const propertyValue = propertyNode.value;

  if (!objectValue || !propertyValue) {
    return null;
  }

  if (isConsoleMember(propertyValue, objectValue)) {
    return { type: 'console', offset, method: propertyValue };
  }

  return null;
}

/**
 * Detect global function calls: alert/confirm/prompt and eval
 */
function detectGlobalFunctionCall(callee: Node, offset: number): LintDetection | null {
  const calleeType = (callee as { type?: string }).type;

  if (calleeType !== 'Identifier') {
    return null;
  }

  const identifier = callee as IdentifierNode;
  const name = identifier.value;

  if (!name) {
    return null;
  }

  // Dialog functions: alert, confirm, prompt
  if (isDialogFunction(name)) {
    return { type: 'alert', offset, method: name };
  }

  // Eval function
  if (isEvalFunction(name)) {
    return { type: 'eval', offset, method: name };
  }

  return null;
}

// ============================================================================
// MAIN DETECTOR
// ============================================================================

/**
 * Detect lint issue from AST node
 *
 * @param node - SWC AST node
 * @returns Detection result or null if no issue found
 */
export function detectLintIssue(node: Node): LintDetection | null {
  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (!span || !nodeType) {
    return null;
  }

  const offset = span.start;

  // 1. Debugger statement
  const debuggerResult = detectDebuggerStatement(nodeType, offset);
  if (debuggerResult) return debuggerResult;

  // 2. Empty catch block
  const emptyCatchResult = detectEmptyCatchBlock(node, nodeType, offset);
  if (emptyCatchResult) return emptyCatchResult;

  // 3. Call expressions (console, alert, eval)
  const callee = extractCallee(node, nodeType);
  if (!callee) return null;

  // 3a. Console method calls
  const consoleResult = detectConsoleCall(callee, offset);
  if (consoleResult) return consoleResult;

  // 3b. Global function calls (alert, eval)
  const globalResult = detectGlobalFunctionCall(callee, offset);
  if (globalResult) return globalResult;

  return null;
}

// ============================================================================
// SPECIALIZED DETECTORS
// ============================================================================

/**
 * Detect console calls specifically
 */
export function detectConsole(node: Node): LintDetection | null {
  const result = detectLintIssue(node);
  return result?.type === 'console' ? result : null;
}

/**
 * Detect debugger statements specifically
 */
export function detectDebugger(node: Node): LintDetection | null {
  const result = detectLintIssue(node);
  return result?.type === 'debugger' ? result : null;
}

/**
 * Detect alert/confirm/prompt calls specifically
 */
export function detectAlert(node: Node): LintDetection | null {
  const result = detectLintIssue(node);
  return result?.type === 'alert' ? result : null;
}

/**
 * Detect eval calls specifically
 */
export function detectEval(node: Node): LintDetection | null {
  const result = detectLintIssue(node);
  return result?.type === 'eval' ? result : null;
}

/**
 * Detect empty catch blocks specifically
 */
export function detectEmptyCatch(node: Node): LintDetection | null {
  const result = detectLintIssue(node);
  return result?.type === 'empty-catch' ? result : null;
}
