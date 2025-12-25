/**
 * @module lib/@swc/detectors/security-detector
 * @description SWC AST detector for security issues
 *
 * Detects:
 * - Command injection (execSync/exec/spawn with template literals)
 * - Path traversal (path.join/resolve with variable arguments)
 */

import type { Node, Span } from '@swc/core';
import type { SecurityDetection } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Child process methods that can lead to command injection */
const COMMAND_EXEC_METHODS = ['execSync', 'exec', 'spawn', 'spawnSync'] as const;

/** Path methods that can lead to path traversal */
const PATH_METHODS = ['join', 'resolve'] as const;

// ============================================================================
// MAIN DETECTOR
// ============================================================================

/**
 * Detect security issue from AST node
 *
 * @param node - SWC AST node
 * @returns Detection result or null if no issue found
 */
export function detectSecurityIssue(node: Node): SecurityDetection | null {
  const nodeType = (node as { type?: string }).type;
  const span = (node as { span?: Span }).span;

  if (!span) {
    return null;
  }

  // Only process CallExpression nodes
  if (nodeType !== 'CallExpression') {
    return null;
  }

  const callExpr = node as {
    callee?: Node;
    arguments?: Node[];
    span?: Span;
  };

  const callee = callExpr.callee;
  if (!callee) {
    return null;
  }

  const calleeType = (callee as { type?: string }).type;

  // 1. Command Injection - execSync, exec, spawn with template literals
  if (calleeType === 'Identifier') {
    const identifier = callee as { value?: string };
    const identifierValue = identifier.value;

    if (
      identifierValue &&
      COMMAND_EXEC_METHODS.includes(identifierValue as (typeof COMMAND_EXEC_METHODS)[number])
    ) {
      const args = callExpr.arguments ?? [];
      const firstArg = args[0];

      // Check if first argument is a template literal with expressions
      // Note: SWC wraps arguments in { spread, expression } objects
      if (firstArg) {
        const argExpr = (firstArg as { expression?: Node }).expression;
        if (argExpr) {
          const argType = (argExpr as { type?: string }).type;
          if (argType === 'TemplateLiteral') {
            const templateLiteral = argExpr as { expressions?: unknown[] };
            const expressions = templateLiteral.expressions ?? [];

            // Template literal with interpolation = potential injection
            if (expressions.length > 0) {
              return {
                type: 'command-injection',
                offset: span.start,
                method: identifierValue,
              };
            }
          }
        }
      }
    }
  }

  // 2. Path Traversal - path.join() or path.resolve() with variables
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

    // Check if object is "path"
    const objectType = (object as { type?: string }).type;
    if (objectType === 'Identifier') {
      const objectValue = (object as { value?: string }).value;
      if (objectValue === 'path') {
        // Check if property is join or resolve
        const propertyType = (property as { type?: string }).type;
        if (propertyType === 'Identifier') {
          const propertyValue = (property as { value?: string }).value;
          if (
            propertyValue &&
            PATH_METHODS.includes(propertyValue as (typeof PATH_METHODS)[number])
          ) {
            const args = callExpr.arguments ?? [];

            // If there are arguments that are identifiers (variables), flag it
            // Note: SWC wraps arguments in { spread, expression } objects
            const hasVariableArgs = args.some((arg) => {
              const argExpr = (arg as { expression?: Node }).expression;
              if (argExpr) {
                const argType = (argExpr as { type?: string }).type;
                return argType === 'Identifier';
              }
              return false;
            });

            if (hasVariableArgs) {
              return {
                type: 'path-traversal',
                offset: span.start,
                method: `path.${propertyValue}`,
              };
            }
          }
        }
      }
    }
  }

  return null;
}

// ============================================================================
// SPECIALIZED DETECTORS
// ============================================================================

/**
 * Detect command injection specifically
 *
 * Detects dangerous patterns like:
 * - execSync(\`rm -rf \${userInput}\`)
 * - spawn(\`echo \${data}\`)
 */
export function detectCommandInjection(node: Node): SecurityDetection | null {
  const result = detectSecurityIssue(node);
  return result?.type === 'command-injection' ? result : null;
}

/**
 * Detect path traversal specifically
 *
 * Detects patterns like:
 * - path.join(baseDir, userInput)
 * - path.resolve(dir, fileName)
 */
export function detectPathTraversal(node: Node): SecurityDetection | null {
  const result = detectSecurityIssue(node);
  return result?.type === 'path-traversal' ? result : null;
}
