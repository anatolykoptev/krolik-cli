/**
 * @module lib/@detectors/lint/detector
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
import type { LintDetection } from '../ast/types';
import { isConsoleMember, isDialogFunction, isEvalFunction } from '../browser-apis';

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

  if (!span) {
    return null;
  }

  // 1. Debugger statement
  if (nodeType === 'DebuggerStatement') {
    return {
      type: 'debugger',
      offset: span.start,
    };
  }

  // 2. Empty catch block
  if (nodeType === 'CatchClause') {
    const catchClause = node as {
      body?: {
        type?: string;
        stmts?: unknown[];
      };
    };

    const body = catchClause.body;
    if (body && body.type === 'BlockStatement') {
      const stmts = body.stmts ?? [];

      // Empty catch block
      if (stmts.length === 0) {
        return {
          type: 'empty-catch',
          offset: span.start,
        };
      }

      // Catch with only return statement (also considered empty handling)
      if (stmts.length === 1) {
        const stmt = stmts[0] as { type?: string };
        if (stmt.type === 'ReturnStatement') {
          return {
            type: 'empty-catch',
            offset: span.start,
          };
        }
      }
    }
  }

  // 3. CallExpression or OptionalChainingExpression - check for console, alert, eval
  if (nodeType === 'CallExpression' || nodeType === 'OptionalChainingExpression') {
    const callExpr = node as {
      callee?: Node;
      base?: Node; // For OptionalChainingExpression
      span?: Span;
    };

    // Get the actual callee (might be in 'base' for optional chaining)
    const callee = callExpr.callee ?? callExpr.base;
    if (!callee) {
      return null;
    }

    const calleeType = (callee as { type?: string }).type;

    // 3a. MemberExpression - console.* method calls (object-based detection)
    if (calleeType === 'MemberExpression') {
      const memberExpr = callee as {
        object?: Node;
        property?: Node;
      };

      const object = memberExpr.object;
      const property = memberExpr.property;

      if (!object || !property) {
        return null;
      }

      // Get object and property values for pattern-based detection
      const objectType = (object as { type?: string }).type;
      const propertyType = (property as { type?: string }).type;

      if (objectType === 'Identifier' && propertyType === 'Identifier') {
        const objectValue = (object as { value?: string }).value;
        const propertyValue = (property as { value?: string }).value;

        // Use pattern-based console detection (any console.* method)
        if (objectValue && propertyValue && isConsoleMember(propertyValue, objectValue)) {
          return {
            type: 'console',
            offset: span.start,
            method: propertyValue,
          };
        }
      }
    }

    // 3b. Identifier - alert(), confirm(), prompt(), eval()
    if (calleeType === 'Identifier') {
      const identifier = callee as { value?: string };
      const identifierValue = identifier.value;

      if (!identifierValue) {
        return null;
      }

      // Use pattern-based dialog function detection (global window APIs)
      if (isDialogFunction(identifierValue)) {
        return {
          type: 'alert',
          offset: span.start,
          method: identifierValue,
        };
      }

      // Use pattern-based eval detection
      if (isEvalFunction(identifierValue)) {
        return {
          type: 'eval',
          offset: span.start,
          method: identifierValue,
        };
      }
    }
  }

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
